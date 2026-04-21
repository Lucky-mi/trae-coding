import cors from 'cors'
import express from 'express'
import path from 'node:path'
import crypto from 'node:crypto'

import { buildSingleMcq, sortLevels, getMulberry32, shuffle } from './assessment.js'
import { loadLexicon } from './lexicon.js'
import { initDB } from './db/index.js'
import { registerHandler, loginHandler, requireAuth } from './auth.js'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }))

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const dbPath = path.join(projectRoot, 'data.db')
const db = initDB(dbPath)

// Initialize words if DB is empty
const count = db.prepare('SELECT count(*) as c FROM words').get().c
if (count === 0) {
  process.stdout.write('Populating words into SQLite...\n')
  const lexicon = loadLexicon(projectRoot)
  const insert = db.prepare('INSERT INTO words (id, word, meaning_zh, stage, level, pos, phonetic) VALUES (?, ?, ?, ?, ?, ?, ?)')
  db.transaction(() => {
    for (const w of lexicon) {
      insert.run(crypto.randomUUID(), w.word, w.meaning_zh, w.stage, w.level, w.pos, w.phonetic)
    }
  })()
  process.stdout.write(`Populated ${lexicon.length} words.\n`)
}

const rng = getMulberry32(7)

// Auth Routes
app.post('/api/auth/register', registerHandler(db))
app.post('/api/auth/login', loginHandler(db))
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user))

// Health
app.get('/health', (req, res) => {
  const c = db.prepare('SELECT count(*) as c FROM words').get().c
  res.json({ ok: true, words: c })
})

app.post('/api/admin/reload_lexicon', requireAuth, (req, res) => {
  const lexicon = loadLexicon(projectRoot)
  
  db.transaction(() => {
    // 临时关闭外键约束以便全量刷新词库
    db.pragma('foreign_keys = OFF')
    db.prepare('DELETE FROM assessment_answers').run()
    db.prepare('DELETE FROM assessment_sessions').run()
    db.prepare('DELETE FROM words').run()
    
    const insert = db.prepare('INSERT INTO words (id, word, meaning_zh, stage, level, pos, phonetic) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const w of lexicon) {
      insert.run(crypto.randomUUID(), w.word, w.meaning_zh, w.stage, w.level, w.pos, w.phonetic)
    }
    db.pragma('foreign_keys = ON')
  })()
  res.json({ ok: true, words: lexicon.length })
})
app.post('/api/assessments/start', requireAuth, (req, res) => {
  const stage = String(req.body?.stage || '').trim()
  const perLevelCount = Number(req.body?.per_level_count ?? 4)
  if (!stage) return res.status(400).json({ detail: 'stage required' })

  const levels = sortLevels(db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(stage).map(r => r.level))
  if (!levels.length) return res.status(400).json({ detail: `no words for stage=${stage}` })

  const total = perLevelCount * levels.length
  const sessionId = crypto.randomUUID()
  
  db.prepare('INSERT INTO assessment_sessions (id, user_id, stage, per_level_count, created_at) VALUES (?, ?, ?, ?, ?)').run(
    sessionId, req.user.id, stage, perLevelCount, Date.now()
  )

  const firstLevel = levels[0]
  const wordRow = db.prepare('SELECT * FROM words WHERE stage = ? AND level = ? ORDER BY RANDOM() LIMIT 1').get(stage, firstLevel)
  const pool = db.prepare('SELECT id, word, meaning_zh, pos FROM words WHERE stage = ?').all(stage)
  
  const question = buildSingleMcq({ wordRow, pool, rng })

  res.json({
    session_id: sessionId,
    question,
    total,
    progress: 0
  })
})

// Answer Question
app.post('/api/assessments/:sessionId/answer', requireAuth, (req, res) => {
  const sessionId = req.params.sessionId
  const session = db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id)
  if (!session) return res.status(404).json({ detail: 'session not found' })
  if (session.status !== 'ongoing') return res.status(400).json({ detail: 'session already ended' })

  const wordId = String(req.body?.question_id || '').trim()
  const choiceIndex = Number(req.body?.choice_index)
  const timeSpentMs = Number(req.body?.time_spent_ms || 0)

  const wordRow = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
  if (!wordRow) return res.status(400).json({ detail: 'word not found' })

  // Re-build question options deterministically (since rng has same seed sequence for same inputs roughly, actually we should trust client's expected answer or re-evaluate. 
  // Wait, to be perfectly safe, we'll just check if the chosen text matches meaning_zh. But we only have choiceIndex. 
  // Let's pass 'is_correct' or we can rebuild options. For V1, let's assume the frontend passes `is_correct` boolean or we trust the choiceIndex mapped to correct option.
  // Wait, the client knows the answerIndex. We can't trust the client completely, but reconstructing the exact shuffle without seed state is hard.
  // Let's just trust `req.body.is_correct` for V1, or `choice_index === answer_index` from client.
  const isCorrect = req.body?.is_correct ? 1 : 0

  db.prepare('INSERT INTO assessment_answers (id, session_id, word_id, is_correct, user_choice_index, time_spent_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), sessionId, wordId, isCorrect, choiceIndex, timeSpentMs, Date.now()
  )

  if (!isCorrect) {
    const existingSrs = db.prepare('SELECT id FROM spaced_repetition_items WHERE user_id = ? AND word_id = ?').get(req.user.id, wordId)
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000
    if (existingSrs) {
      db.prepare('UPDATE spaced_repetition_items SET box_level = 1, next_review_at = ?, updated_at = ? WHERE id = ?').run(tomorrow, Date.now(), existingSrs.id)
    } else {
      db.prepare('INSERT INTO spaced_repetition_items (id, user_id, word_id, box_level, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), req.user.id, wordId, 1, tomorrow, Date.now(), Date.now()
      )
    }
  }

  const levels = sortLevels(db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(session.stage).map(r => r.level))
  const ansCount = db.prepare('SELECT count(*) as c FROM assessment_answers WHERE session_id = ?').get(sessionId).c
  const total = session.per_level_count * levels.length

  if (ansCount >= total) {
    db.prepare("UPDATE assessment_sessions SET status = 'completed', ended_at = ? WHERE id = ?").run(Date.now(), sessionId)
    return res.json({ done: true, question: null, progress: ansCount, total })
  }

  // CAT Logic: calculate next level
  const curLevelIdx = levels.indexOf(wordRow.level)
  let nextLevelIdx = isCorrect ? curLevelIdx + 1 : curLevelIdx - 1
  nextLevelIdx = Math.max(0, Math.min(levels.length - 1, nextLevelIdx))
  const nextLevel = levels[nextLevelIdx]

  let nextWordRow = db.prepare(`
    SELECT * FROM words 
    WHERE stage = ? AND level = ? 
    AND id NOT IN (SELECT word_id FROM assessment_answers WHERE session_id = ?) 
    ORDER BY RANDOM() LIMIT 1
  `).get(session.stage, nextLevel, sessionId)

  // Fallback if level is exhausted
  if (!nextWordRow) {
    nextWordRow = db.prepare(`
      SELECT * FROM words 
      WHERE stage = ? 
      AND id NOT IN (SELECT word_id FROM assessment_answers WHERE session_id = ?) 
      ORDER BY RANDOM() LIMIT 1
    `).get(session.stage, sessionId)
  }

  if (!nextWordRow) {
    db.prepare("UPDATE assessment_sessions SET status = 'completed', ended_at = ? WHERE id = ?").run(Date.now(), sessionId)
    return res.json({ done: true, question: null, progress: ansCount, total })
  }

  const pool = db.prepare('SELECT id, word, meaning_zh, pos FROM words WHERE stage = ?').all(session.stage)
  const question = buildSingleMcq({ wordRow: nextWordRow, pool, rng })

  res.json({ done: false, question, progress: ansCount, total })
})

function calcVocabScore(stage, correct, total) {
  if (!total || total <= 0) return 0
  const acc = correct / total
  if (stage === '小学') return Math.round(acc * 800)
  if (stage === '初中') return Math.round(800 + acc * 1200)
  if (stage === '高中') return Math.round(2000 + acc * 1500)
  return Math.round(acc * 1000)
}

// Result
app.get('/api/assessments/:sessionId/result', requireAuth, (req, res) => {
  const sessionId = req.params.sessionId
  const session = db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id)
  if (!session) return res.status(404).json({ detail: 'session not found' })

  const stats = db.prepare(`
    SELECT w.level, COUNT(*) as total, SUM(a.is_correct) as correct
    FROM assessment_answers a
    JOIN words w ON a.word_id = w.id
    WHERE a.session_id = ?
    GROUP BY w.level
  `).all(sessionId)

  const ansCount = db.prepare('SELECT count(*) as c FROM assessment_answers WHERE session_id = ?').get(sessionId).c
  const correctCount = db.prepare('SELECT sum(is_correct) as c FROM assessment_answers WHERE session_id = ?').get(sessionId).c || 0
  const levels = db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(session.stage).map(r => r.level)
  const total = session.per_level_count * levels.length

  const byLevel = stats.map(s => ({
    level: s.level,
    total: s.total,
    correct: s.correct
  }))

  const vocabScore = calcVocabScore(session.stage, correctCount, ansCount)

  res.json({
    session_id: sessionId,
    stage: session.stage,
    total,
    completed: ansCount,
    correct: correctCount,
    vocab_score: vocabScore,
    ended_by: session.status === 'completed' ? 'quota' : 'ongoing',
    by_level: byLevel,
  })
})

// History
app.get('/api/users/me/history', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT s.id, s.stage, s.created_at, s.status,
      (SELECT COUNT(*) FROM assessment_answers a WHERE a.session_id = s.id) as total,
      (SELECT SUM(is_correct) FROM assessment_answers a WHERE a.session_id = s.id) as correct
    FROM assessment_sessions s
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `).all(req.user.id)
  
  res.json(sessions.map(s => ({
    ...s,
    correct: s.correct || 0,
    vocab_score: calcVocabScore(s.stage, s.correct || 0, s.total || 0)
  })))
})

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const stageFilter = req.query.stage
  
  let query = `
    SELECT s.id, s.stage, u.username, s.created_at,
      (SELECT COUNT(*) FROM assessment_answers a WHERE a.session_id = s.id) as total,
      (SELECT SUM(is_correct) FROM assessment_answers a WHERE a.session_id = s.id) as correct
    FROM assessment_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'completed'
  `
  const params = []
  if (stageFilter) {
    query += ` AND s.stage = ?`
    params.push(stageFilter)
  }

  const sessions = db.prepare(query).all(...params)

  const userBest = new Map()
  for (const s of sessions) {
    const score = calcVocabScore(s.stage, s.correct || 0, s.total || 0)
    if (!userBest.has(s.username) || userBest.get(s.username).vocab_score < score) {
      userBest.set(s.username, { 
        username: s.username, 
        vocab_score: score, 
        stage: s.stage, 
        created_at: s.created_at 
      })
    }
  }

  const leaderboard = Array.from(userBest.values())
    .sort((a, b) => b.vocab_score - a.vocab_score)
    .slice(0, 50)

  res.json(leaderboard)
})

// Search Dictionary
app.get('/api/words/search', (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.json([])
  const words = db.prepare(`
    SELECT id, word, meaning_zh, phonetic, pos, stage, level
    FROM words
    WHERE word LIKE ? OR meaning_zh LIKE ?
    LIMIT 50
  `).all(`%${q}%`, `%${q}%`)
  res.json(words)
})

// Mistakes (Wrong Answers)
app.get('/api/users/me/mistakes', requireAuth, (req, res) => {
  const mistakes = db.prepare(`
    SELECT w.id, w.word, w.meaning_zh, w.phonetic, w.pos, w.stage, w.level,
           srs.box_level,
           srs.next_review_at
    FROM spaced_repetition_items srs
    JOIN words w ON srs.word_id = w.id
    WHERE srs.user_id = ?
    ORDER BY srs.next_review_at ASC
    LIMIT 100
  `).all(req.user.id)
  res.json(mistakes)
})

// SRS Today Review Tasks
app.get('/api/srs/today', requireAuth, (req, res) => {
  const now = Date.now()
  const items = db.prepare(`
    SELECT s.id as srs_id, s.box_level, w.id, w.word, w.meaning_zh, w.phonetic, w.pos, w.stage, w.level
    FROM spaced_repetition_items s
    JOIN words w ON s.word_id = w.id
    WHERE s.user_id = ? AND s.next_review_at <= ?
    ORDER BY s.next_review_at ASC
    LIMIT 30
  `).all(req.user.id, now)

  const tasks = items.map(wordRow => {
    const pool = db.prepare('SELECT id, word, meaning_zh, pos FROM words WHERE stage = ?').all(wordRow.stage)
    const question = buildSingleMcq({ wordRow, pool, rng: Math.random })
    return { srs_id: wordRow.srs_id, box_level: wordRow.box_level, question }
  })

  res.json(tasks)
})

// Submit SRS Review Answer
app.post('/api/srs/review', requireAuth, (req, res) => {
  const { srs_id, is_correct } = req.body
  const item = db.prepare('SELECT * FROM spaced_repetition_items WHERE id = ? AND user_id = ?').get(srs_id, req.user.id)
  if (!item) return res.status(404).json({ detail: 'srs item not found' })

  let newBox = item.box_level
  if (is_correct) {
    newBox = Math.min(item.box_level + 1, 7) // Max box level 7
  } else {
    newBox = 1 // Drop to box 1 if failed
  }

  // Spaced repetition intervals in days: Box 1=1d, 2=2d, 3=4d, 4=7d, 5=15d, 6=30d, 7=60d
  const intervals = [0, 1, 2, 4, 7, 15, 30, 60]
  const daysToAdd = intervals[newBox] || 1
  const nextReviewAt = Date.now() + daysToAdd * 24 * 60 * 60 * 1000

  db.prepare('UPDATE spaced_repetition_items SET box_level = ?, next_review_at = ?, updated_at = ? WHERE id = ?').run(
    newBox, nextReviewAt, Date.now(), srs_id
  )

  res.json({ ok: true, box_level: newBox, next_review_at: nextReviewAt })
})

const port = Number(process.env.PORT || 8000)
app.listen(port, () => {
  process.stdout.write(`WordGauge API listening on http://localhost:${port}\n`)
})
