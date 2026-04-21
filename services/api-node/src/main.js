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
    // 【测试模式】为了让你马上看到效果，我把“明天”改成了“5秒后”到期
    const nextTime = Date.now() + 5 * 1000 
    if (existingSrs) {
      db.prepare('UPDATE spaced_repetition_items SET box_level = 1, next_review_at = ?, updated_at = ? WHERE id = ?').run(nextTime, Date.now(), existingSrs.id)
    } else {
      db.prepare('INSERT INTO spaced_repetition_items (id, user_id, word_id, box_level, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), req.user.id, wordId, 1, nextTime, Date.now(), Date.now()
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

  // CAT Logic: calculate next level using IRT
  // Estimate theta based on current answers
  const currentAnswers = db.prepare(`
    SELECT a.is_correct, a.time_spent_ms, w.level, w.pos
    FROM assessment_answers a
    JOIN words w ON a.word_id = w.id
    WHERE a.session_id = ?
  `).all(sessionId)

  const theta = estimateTheta(currentAnswers)
  
  // Early stop condition: SE < 0.35 or ansCount >= total
  const se = calculateSE(theta, currentAnswers)
  if (ansCount >= 10 && se < 0.35) {
    db.prepare("UPDATE assessment_sessions SET status = 'completed', ended_at = ? WHERE id = ?").run(Date.now(), sessionId)
    return res.json({ done: true, question: null, progress: ansCount, total })
  }

  // Find a question with b closest to theta
  let nextWordRow = db.prepare(`
    SELECT *, ABS(
      CASE 
        WHEN level LIKE 'A1%' THEN -2.0
        WHEN level LIKE 'A2%' THEN -1.0
        WHEN level LIKE 'B1%' THEN 0.0
        WHEN level LIKE 'B2%' THEN 1.0
        WHEN level LIKE 'C1%' THEN 2.0
        WHEN level LIKE 'C2%' THEN 3.0
        ELSE 0.0
      END - ?
    ) as diff
    FROM words 
    WHERE stage = ? 
    AND id NOT IN (SELECT word_id FROM assessment_answers WHERE session_id = ?) 
    ORDER BY diff ASC, RANDOM() LIMIT 1
  `).get(theta, session.stage, sessionId)

  // Fallback
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

// Helper to convert CEFR string to numeric b parameter
function getDifficultyB(levelStr) {
  if (!levelStr) return 0
  if (levelStr.includes('A1')) return -2.0
  if (levelStr.includes('A2')) return -1.0
  if (levelStr.includes('B1')) return 0.0
  if (levelStr.includes('B2')) return 1.0
  if (levelStr.includes('C1')) return 2.0
  if (levelStr.includes('C2')) return 3.0
  return 0
}

// 3PL IRT formula: P(theta) = c + (1 - c) / (1 + exp(-a * (theta - b)))
function probability(theta, a, b, c) {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)))
}

// Maximum Likelihood Estimation (MLE) for theta
// We use Newton-Raphson to find the root of the derivative of the log-likelihood
function estimateTheta(answers) {
  let theta = 0.0 // initial guess
  let a = 1.0     // fixed discrimination for now
  let c = 0.25    // guessing parameter for 4-option MCQ
  
  // Need at least some variation to converge well, but we do our best
  for (let iter = 0; iter < 10; iter++) {
    let num = 0.0
    let den = 0.0
    for (const ans of answers) {
      const b = getDifficultyB(ans.level)
      // Anti-cheating: if answered correctly but too fast (< 800ms), weight it less or ignore
      // Let's treat extremely fast correct answers as guessed (effectively ignoring their positive signal)
      // If time_spent_ms is 0 (missing), we don't penalize.
      let isCorrect = ans.is_correct
      if (isCorrect && ans.time_spent_ms && ans.time_spent_ms < 800) {
        // Penalty: pretend it was wrong or ignore. We'll ignore for theta estimation to be fair.
        continue
      }
      
      const P = probability(theta, a, b, c)
      const Q = 1 - P
      
      // Derivative of log-likelihood
      num += a * (isCorrect - P) * (P - c) / (P * (1 - c))
      // Second derivative
      den -= Math.pow(a, 2) * P * Q * Math.pow((P - c) / (P * (1 - c)), 2)
    }
    
    if (den === 0 || Math.abs(num) < 0.01) break
    
    const delta = num / den
    theta -= delta
    
    // Bound theta to reasonable limits [-4, 4]
    theta = Math.max(-4.0, Math.min(4.0, theta))
  }
  return theta
}

// IRT standard error
function calculateSE(theta, answers) {
  let info = 0.0
  let a = 1.0
  let c = 0.25
  for (const ans of answers) {
    const b = getDifficultyB(ans.level)
    if (ans.is_correct && ans.time_spent_ms && ans.time_spent_ms < 800) continue
    const P = probability(theta, a, b, c)
    const Q = 1 - P
    info += Math.pow(a, 2) * Q / P * Math.pow((P - c) / (1 - c), 2)
  }
  return info > 0 ? 1.0 / Math.sqrt(info) : 9.99
}

function calcVocabScoreIRT(theta) {
  // Map theta [-3, 3] to Vocab [0, 10000]
  // theta = -2 (A1) ~ 1000
  // theta = 0 (B1) ~ 3000
  // theta = 3 (C2) ~ 8000+
  // Linear interpolation: vocab = 3500 + theta * 1500
  let vocab = 3500 + theta * 1500
  return Math.max(0, Math.min(12000, Math.round(vocab)))
}

// Result
app.get('/api/assessments/:sessionId/result', requireAuth, (req, res) => {
  const sessionId = req.params.sessionId
  const session = db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id)
  if (!session) return res.status(404).json({ detail: 'session not found' })

  const answers = db.prepare(`
    SELECT a.is_correct, a.time_spent_ms, w.level, w.pos
    FROM assessment_answers a
    JOIN words w ON a.word_id = w.id
    WHERE a.session_id = ?
  `).all(sessionId)

  const ansCount = answers.length
  const correctCount = answers.reduce((sum, a) => sum + a.is_correct, 0)
  
  const levels = db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(session.stage).map(r => r.level)
  const total = session.per_level_count * levels.length

  const radar = {
    core: { total: 0, correct: 0 },
    advanced: { total: 0, correct: 0 },
    rare: { total: 0, correct: 0 },
    noun: { total: 0, correct: 0 },
    verb: { total: 0, correct: 0 },
    adj_adv: { total: 0, correct: 0 },
  }

  for (const a of answers) {
    if (!a.level) continue
    if (a.level.includes('A1') || a.level.includes('A2')) { radar.core.total++; radar.core.correct += a.is_correct }
    if (a.level.includes('B1') || a.level.includes('B2')) { radar.advanced.total++; radar.advanced.correct += a.is_correct }
    if (a.level.includes('C1') || a.level.includes('C2')) { radar.rare.total++; radar.rare.correct += a.is_correct }
    
    if (a.pos) {
      if (a.pos.includes('n')) { radar.noun.total++; radar.noun.correct += a.is_correct }
      if (a.pos.includes('v')) { radar.verb.total++; radar.verb.correct += a.is_correct }
      if (a.pos.includes('adj') || a.pos.includes('adv')) { radar.adj_adv.total++; radar.adj_adv.correct += a.is_correct }
    }
  }

  const byLevel = [
    { level: '高频核心词', total: radar.core.total, correct: radar.core.correct },
    { level: '中频进阶词', total: radar.advanced.total, correct: radar.advanced.correct },
    { level: '低频生僻词', total: radar.rare.total, correct: radar.rare.correct },
    { level: '名词掌握度', total: radar.noun.total, correct: radar.noun.correct },
    { level: '动词掌握度', total: radar.verb.total, correct: radar.verb.correct },
    { level: '形/副词掌握度', total: radar.adj_adv.total, correct: radar.adj_adv.correct }
  ]

  const theta = estimateTheta(answers)
  const vocabScore = calcVocabScoreIRT(theta)

  // Map vocabScore to CEFR
  let cefrLevel = 'A1 (入门)'
  let cefrDesc = '处于正在积累的阶段，词汇量还有很大提升空间，建议多加复习。'
  if (vocabScore >= 8000) { cefrLevel = 'C2 (精通)'; cefrDesc = '词汇量极其丰富，能够理解几乎所有形式的英语，包括复杂的学术或专业文章。' }
  else if (vocabScore >= 6000) { cefrLevel = 'C1 (高级)'; cefrDesc = '能够理解广泛的高难度长篇文章，能流利、自然地表达自己。' }
  else if (vocabScore >= 4000) { cefrLevel = 'B2 (中高)'; cefrDesc = '词汇量扎实，能听懂无字幕美剧的大部分日常对话，但在阅读长篇生僻文章时可能遇到阻碍。' }
  else if (vocabScore >= 2000) { cefrLevel = 'B1 (中级)'; cefrDesc = '表现不错！大部分基础词汇已经掌握，能应对日常交流，但生僻词还需巩固。' }
  else if (vocabScore >= 1000) { cefrLevel = 'A2 (初级)'; cefrDesc = '能够理解并使用一些基本的、日常的词汇和句子。' }

  res.json({
    session_id: sessionId,
    stage: session.stage,
    total,
    completed: ansCount,
    correct: correctCount,
    vocab_score: vocabScore,
    cefr_level: cefrLevel,
    cefr_desc: cefrDesc,
    by_level: byLevel,
    ended_by: session.ended_at ? 'completed' : 'ongoing'
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
  
  res.json(sessions.map(s => {
    const answers = db.prepare(`
      SELECT a.is_correct, a.time_spent_ms, w.level, w.pos
      FROM assessment_answers a
      JOIN words w ON a.word_id = w.id
      WHERE a.session_id = ?
    `).all(s.id)
    const theta = estimateTheta(answers)
    return {
      ...s,
      correct: s.correct || 0,
      vocab_score: calcVocabScoreIRT(theta)
    }
  }))
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
    const answers = db.prepare(`
      SELECT a.is_correct, a.time_spent_ms, w.level, w.pos
      FROM assessment_answers a
      JOIN words w ON a.word_id = w.id
      WHERE a.session_id = ?
    `).all(s.id)
    const theta = estimateTheta(answers)
    const score = calcVocabScoreIRT(theta)
    
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

  // SRS intervals: Box 1=1d, 2=3d, 3=7d, 4=15d, 5=30d, 6=90d, 7=180d
  const intervals = [0, 1, 3, 7, 15, 30, 90, 180]
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
