import cors from 'cors'
import express from 'express'
import path from 'node:path'
import crypto from 'node:crypto'

import { buildContrastAnalysis, buildSingleMcq, findRelatedWords, sortLevels, getMulberry32 } from './assessment.js'
import { loadLexicon } from './lexicon.js'
import { initDB } from './db/index.js'
import { registerHandler, loginHandler, refreshHandler, logoutHandler, requireAuth, requireAdmin, optionalAuth, meHandler } from './auth.js'
import { logEvent, requestLogger, requestMeta } from './logger.js'
import { evaluateAchievements, getUserAchievements, getUserProgressSummary, touchUserActivity } from './progress.js'

const app = express()
app.use(requestLogger)
app.use(express.json({ limit: '1mb' }))

const allowedOrigins = (
  process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://lucky-puppy5808e4.netlify.app',
      ]
)

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const dbPath = path.join(projectRoot, 'data.db')
const db = initDB(dbPath)

function getReviewAtByBox(boxLevel, now = Date.now()) {
  const rules = getActiveRuleset()
  const intervals = rules.srs_intervals_days || [0, 1, 3, 7, 15, 30, 90, 180]
  const daysToAdd = intervals[boxLevel] || 1
  return now + daysToAdd * 24 * 60 * 60 * 1000
}

function getActiveRuleset() {
  const row = db.prepare('SELECT config_json FROM rulesets WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1').get()
  if (!row) {
    return {
      srs_intervals_days: [0, 1, 3, 7, 15, 30, 90, 180],
      assessment_exp_correct: 10,
      review_exp_correct: 5,
      irt_se_threshold: 0.35,
      irt_min_answers_before_converge: 10,
      anti_cheat_fast_answer_ms: 800,
    }
  }
  return JSON.parse(row.config_json)
}

function resolveActor(req) {
  const auth = req.headers.authorization || ''
  const hasBearer = /^Bearer\s+/i.test(auth)
  if (hasBearer && req.user?.id) {
    return { userId: req.user.id, guestId: null, authMode: 'user' }
  }
  const guestIdRaw = String(req.headers['x-guest-id'] || req.body?.guest_id || '').trim()
  if (!guestIdRaw) {
    return null
  }
  return { userId: null, guestId: guestIdRaw.slice(0, 64), authMode: 'guest' }
}

function createQuestionSnapshot({ userId, scope, sessionId = null, sourceId = null, question }) {
  const snapshotId = crypto.randomUUID()
  db.prepare(`
    INSERT INTO question_snapshots
      (id, user_id, scope, session_id, source_id, word_id, options_json, answer_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    snapshotId,
    userId,
    scope,
    sessionId,
    sourceId,
    question.id,
    JSON.stringify(question.options),
    question.answerIndex,
    Date.now(),
  )
  return {
    ...question,
    id: snapshotId,
  }
}

function endSession(sessionId, endedBy) {
  db.prepare("UPDATE assessment_sessions SET status = 'completed', ended_at = ?, ended_by = ? WHERE id = ?").run(
    Date.now(),
    endedBy,
    sessionId,
  )
}

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
  logEvent('info', 'lexicon_bootstrap_completed', { words: lexicon.length, db_path: dbPath })
}

function createRng() {
  const seed = Math.floor(Math.random() * 0xffffffff)
  return getMulberry32(seed)
}

// Auth Routes
app.post('/api/auth/register', registerHandler(db))
app.post('/api/auth/login', loginHandler(db))
app.post('/api/auth/refresh', refreshHandler(db))
app.post('/api/auth/logout', logoutHandler(db))
app.get('/api/auth/me', requireAuth, meHandler(db))

// Health
app.get('/health', (_req, res) => {
  const c = db.prepare('SELECT count(*) as c FROM words').get().c
  res.json({ ok: true, words: c })
})

app.post('/api/admin/reload_lexicon', requireAuth, requireAdmin(db), (_req, res) => {
  const lexicon = loadLexicon(projectRoot)
  logEvent('info', 'admin_reload_lexicon_started', requestMeta(_req, { lexicon_words: lexicon.length }))
  
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
  logEvent('info', 'admin_reload_lexicon_completed', requestMeta(_req, { lexicon_words: lexicon.length }))
  res.json({ ok: true, words: lexicon.length })
})
app.get('/api/admin/rulesets', requireAuth, requireAdmin(db), (req, res) => {
  const rows = db.prepare('SELECT id, name, is_active, config_json, created_at, updated_at FROM rulesets ORDER BY updated_at DESC').all()
  logEvent('info', 'admin_rulesets_listed', requestMeta(req, { count: rows.length }))
  res.json(rows.map((row) => ({
    ...row,
    config: JSON.parse(row.config_json),
  })))
})

app.post('/api/admin/rulesets', requireAuth, requireAdmin(db), (req, res) => {
  const name = String(req.body?.name || '').trim()
  const config = req.body?.config
  if (!name || !config || typeof config !== 'object') {
    return res.status(400).json({ detail: 'name and config required' })
  }
  const id = crypto.randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO rulesets (id, name, is_active, config_json, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(id, name, JSON.stringify(config), now, now)
  logEvent('info', 'admin_ruleset_created', requestMeta(req, { ruleset_id: id, name }))
  res.json({ ok: true, id })
})

app.post('/api/admin/rulesets/:id/activate', requireAuth, requireAdmin(db), (req, res) => {
  const id = req.params.id
  const exists = db.prepare('SELECT id FROM rulesets WHERE id = ?').get(id)
  if (!exists) return res.status(404).json({ detail: 'ruleset not found' })
  const now = Date.now()
  db.transaction(() => {
    db.prepare('UPDATE rulesets SET is_active = 0, updated_at = ?').run(now)
    db.prepare('UPDATE rulesets SET is_active = 1, updated_at = ? WHERE id = ?').run(now, id)
  })()
  logEvent('info', 'admin_ruleset_activated', requestMeta(req, { ruleset_id: id }))
  res.json({ ok: true })
})

app.post('/api/assessments/start', optionalAuth, (req, res) => {
  const actor = resolveActor(req)
  if (!actor) return res.status(401).json({ detail: '需要登录或匿名访客标识' })
  const stage = String(req.body?.stage || '').trim()
  const perLevelCount = Number(req.body?.per_level_count ?? 4)
  const timeLimitSecRaw = req.body?.time_limit_sec
  const timeLimitSec = timeLimitSecRaw == null ? null : Number(timeLimitSecRaw)
  logEvent('info', 'assessment_start_requested', requestMeta(req, {
    auth_mode: actor.authMode,
    guest_id: actor.guestId,
    stage,
    per_level_count: perLevelCount,
    time_limit_sec: timeLimitSec,
    adaptive: !!req.body?.adaptive,
  }))
  if (!stage) {
    logEvent('warn', 'assessment_start_missing_stage', requestMeta(req))
    return res.status(400).json({ detail: 'stage required' })
  }

  const levels = sortLevels(db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(stage).map(r => r.level))
  if (!levels.length) {
    logEvent('warn', 'assessment_start_no_words', requestMeta(req, { stage }))
    return res.status(400).json({ detail: `no words for stage=${stage}` })
  }

  const total = perLevelCount * levels.length
  const sessionId = crypto.randomUUID()
  
  const now = Date.now()
  let streakDays = 0
  if (actor.userId) {
    streakDays = touchUserActivity(db, actor.userId, now, 'assessment')
  }
  db.prepare(`
    INSERT INTO assessment_sessions
      (id, user_id, guest_id, stage, per_level_count, time_limit_sec, started_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId, actor.userId, actor.guestId, stage, perLevelCount, timeLimitSec, now, now
  )

  const firstLevel = levels[0]
  const wordRow = db.prepare('SELECT * FROM words WHERE stage = ? AND level = ? ORDER BY RANDOM() LIMIT 1').get(stage, firstLevel)
  const pool = db.prepare('SELECT id, word, meaning_zh, pos FROM words WHERE stage = ?').all(stage)
  const rng = createRng()
  
  const question = createQuestionSnapshot({
    userId: actor.userId || actor.guestId,
    scope: 'assessment',
    sessionId,
    question: buildSingleMcq({ wordRow, pool, rng }),
  })
  logEvent('info', 'assessment_start_success', requestMeta(req, {
    session_id: sessionId,
    stage,
    total,
    streak_days: streakDays || null,
    first_word_id: question.word || null,
    question_snapshot_id: question.id,
    first_level: question.level || null,
  }))

  res.json({
    session_id: sessionId,
    guest_id: actor.guestId,
    question,
    total,
    progress: 0
  })
})

// Answer Question
app.post('/api/assessments/:sessionId/answer', optionalAuth, (req, res) => {
  const actor = resolveActor(req)
  if (!actor) return res.status(401).json({ detail: '需要登录或匿名访客标识' })
  const sessionId = req.params.sessionId
  const session = actor.userId
    ? db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?').get(sessionId, actor.userId)
    : db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND guest_id = ?').get(sessionId, actor.guestId)
  if (!session) return res.status(404).json({ detail: 'session not found' })
  if (session.status !== 'ongoing') return res.status(400).json({ detail: 'session already ended' })

  const snapshotId = String(req.body?.question_id || '').trim()
  const choiceIndex = Number(req.body?.choice_index)
  const timeSpentMs = Number(req.body?.time_spent_ms || 0)
  const now = Date.now()
  logEvent('info', 'assessment_answer_received', requestMeta(req, {
    session_id: sessionId,
    question_snapshot_id: snapshotId,
    choice_index: choiceIndex,
    time_spent_ms: timeSpentMs,
  }))

  if (!session) {
    logEvent('warn', 'assessment_answer_session_missing', requestMeta(req, { session_id: sessionId }))
    return res.status(404).json({ detail: 'session not found' })
  }
  if (session.status !== 'ongoing') {
    logEvent('warn', 'assessment_answer_session_ended', requestMeta(req, { session_id: sessionId, status: session.status }))
    return res.status(400).json({ detail: 'session already ended' })
  }

  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    logEvent('warn', 'assessment_answer_invalid_choice', requestMeta(req, { session_id: sessionId, choice_index: choiceIndex }))
    return res.status(400).json({ detail: 'invalid choice index' })
  }

  if (session.time_limit_sec != null && session.time_limit_sec > 0) {
    const elapsedMs = now - (session.started_at || session.created_at)
    if (elapsedMs >= session.time_limit_sec * 1000) {
      endSession(sessionId, 'time')
      const ansCount = db.prepare('SELECT count(*) as c FROM assessment_answers WHERE session_id = ?').get(sessionId).c
      const levels = sortLevels(db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(session.stage).map(r => r.level))
      const total = session.per_level_count * levels.length
      logEvent('warn', 'assessment_answer_timeout', requestMeta(req, {
        session_id: sessionId,
        elapsed_ms: elapsedMs,
        time_limit_sec: session.time_limit_sec,
        progress: ansCount,
        total,
      }))
      return res.json({ done: true, question: null, progress: ansCount, total, ended_by: 'time' })
    }
  }

  const snapshot = db.prepare(`
    SELECT *
    FROM question_snapshots
    WHERE id = ? AND user_id = ? AND session_id = ? AND scope = 'assessment'
  `).get(snapshotId, actor.userId || actor.guestId, sessionId)
  if (!snapshot) {
    logEvent('warn', 'assessment_answer_snapshot_missing', requestMeta(req, { session_id: sessionId, question_snapshot_id: snapshotId }))
    return res.status(400).json({ detail: 'question snapshot not found' })
  }
  if (snapshot.answered_at) {
    logEvent('warn', 'assessment_answer_duplicate_submission', requestMeta(req, { session_id: sessionId, question_snapshot_id: snapshotId }))
    return res.status(400).json({ detail: 'question already answered' })
  }

  const wordRow = db.prepare('SELECT * FROM words WHERE id = ?').get(snapshot.word_id)
  if (!wordRow) {
    logEvent('error', 'assessment_answer_word_missing', requestMeta(req, { session_id: sessionId, word_id: snapshot.word_id }))
    return res.status(400).json({ detail: 'word not found' })
  }

  const options = JSON.parse(snapshot.options_json)
  if (!Array.isArray(options) || choiceIndex >= options.length) {
    logEvent('warn', 'assessment_answer_choice_out_of_range', requestMeta(req, {
      session_id: sessionId,
      question_snapshot_id: snapshotId,
      options_count: Array.isArray(options) ? options.length : null,
      choice_index: choiceIndex,
    }))
    return res.status(400).json({ detail: 'choice index out of range' })
  }
  const isCorrect = choiceIndex === snapshot.answer_index ? 1 : 0
  logEvent('info', 'assessment_answer_judged', requestMeta(req, {
    session_id: sessionId,
    question_snapshot_id: snapshotId,
    word_id: wordRow.id,
    word: wordRow.word,
    selected_index: choiceIndex,
    correct_index: snapshot.answer_index,
    is_correct: !!isCorrect,
    time_spent_ms: timeSpentMs,
  }))

  db.prepare('INSERT INTO assessment_answers (id, session_id, word_id, is_correct, user_choice_index, time_spent_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), sessionId, wordRow.id, isCorrect, choiceIndex, timeSpentMs, now
  )
  db.prepare('UPDATE question_snapshots SET answered_at = ? WHERE id = ?').run(now, snapshotId)

  // Add EXP if correct
  const rules = getActiveRuleset()
  let addedExp = 0
  if (isCorrect) {
    if (actor.userId) {
      addedExp = Number(rules.assessment_exp_correct || 10)
      db.prepare('UPDATE users SET exp = exp + ? WHERE id = ?').run(addedExp, actor.userId)
    }
  }

  if (!isCorrect) {
    if (actor.userId) {
      const existingSrs = db.prepare('SELECT id FROM spaced_repetition_items WHERE user_id = ? AND word_id = ?').get(actor.userId, wordRow.id)
      const nextTime = getReviewAtByBox(1, now)
      if (existingSrs) {
        db.prepare('UPDATE spaced_repetition_items SET box_level = 1, next_review_at = ?, updated_at = ? WHERE id = ?').run(nextTime, now, existingSrs.id)
        logEvent('info', 'srs_item_reset_to_box1', requestMeta(req, {
          source: 'assessment_wrong_answer',
          word_id: wordRow.id,
          srs_id: existingSrs.id,
          next_review_at: nextTime,
        }))
      } else {
        const newSrsId = crypto.randomUUID()
        db.prepare('INSERT INTO spaced_repetition_items (id, user_id, word_id, box_level, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          newSrsId, actor.userId, wordRow.id, 1, nextTime, now, now
        )
        logEvent('info', 'srs_item_created', requestMeta(req, {
          source: 'assessment_wrong_answer',
          word_id: wordRow.id,
          srs_id: newSrsId,
          next_review_at: nextTime,
        }))
      }
    }
  }

  const levels = sortLevels(db.prepare('SELECT DISTINCT level FROM words WHERE stage = ?').all(session.stage).map(r => r.level))
  const ansCount = db.prepare('SELECT count(*) as c FROM assessment_answers WHERE session_id = ?').get(sessionId).c
  const total = session.per_level_count * levels.length

  if (ansCount >= total) {
    endSession(sessionId, 'quota')
    const unlocked = actor.userId ? evaluateAchievements(db, actor.userId, now) : []
    const summary = actor.userId ? getUserProgressSummary(db, actor.userId) : null
    logEvent('info', 'assessment_session_completed', requestMeta(req, {
      session_id: sessionId,
      ended_by: 'quota',
      progress: ansCount,
      total,
    }))
    return res.json({
      done: true,
      question: null,
      progress: ansCount,
      total,
      ended_by: 'quota',
      added_exp: addedExp,
      current_exp: summary?.exp,
      streak_days: summary?.streak_days,
      new_achievements: unlocked,
    })
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
  if (ansCount >= Number(rules.irt_min_answers_before_converge || 10) && se < Number(rules.irt_se_threshold || 0.35)) {
    endSession(sessionId, 'converge')
    const unlocked = actor.userId ? evaluateAchievements(db, actor.userId, now) : []
    const summary = actor.userId ? getUserProgressSummary(db, actor.userId) : null
    logEvent('info', 'assessment_session_completed', requestMeta(req, {
      session_id: sessionId,
      ended_by: 'converge',
      progress: ansCount,
      total,
      theta,
      se,
    }))
    return res.json({
      done: true,
      question: null,
      progress: ansCount,
      total,
      ended_by: 'converge',
      added_exp: addedExp,
      current_exp: summary?.exp,
      streak_days: summary?.streak_days,
      new_achievements: unlocked,
    })
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
    endSession(sessionId, 'depleted')
    logEvent('warn', 'assessment_session_depleted', requestMeta(req, {
      session_id: sessionId,
      progress: ansCount,
      total,
      theta,
      se,
    }))
    const unlocked = actor.userId ? evaluateAchievements(db, actor.userId, now) : []
    const summary = actor.userId ? getUserProgressSummary(db, actor.userId) : null
    return res.json({
      done: true,
      question: null,
      progress: ansCount,
      total,
      ended_by: 'depleted',
      added_exp: addedExp,
      current_exp: summary?.exp,
      streak_days: summary?.streak_days,
      new_achievements: unlocked,
    })
  }

  const pool = db.prepare('SELECT id, word, meaning_zh, pos FROM words WHERE stage = ?').all(session.stage)
  const rng = createRng()
  const question = createQuestionSnapshot({
    userId: actor.userId || actor.guestId,
    scope: 'assessment',
    sessionId,
    question: buildSingleMcq({ wordRow: nextWordRow, pool, rng }),
  })
  logEvent('info', 'assessment_next_question_created', requestMeta(req, {
    session_id: sessionId,
    progress: ansCount,
    total,
    theta,
    se,
    next_question_snapshot_id: question.id,
    next_word: question.word,
    next_level: question.level || null,
  }))

  const summary = actor.userId ? getUserProgressSummary(db, actor.userId) : null
  res.json({
    done: false,
    question,
    progress: ansCount,
    total,
    added_exp: addedExp,
    current_exp: summary?.exp,
    streak_days: summary?.streak_days,
  })
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

function calcVocabScoreIRT(theta, stage) {
  let vocab = 3500 + theta * 1500
  if (stage === '小学') {
    vocab = 800 + theta * 300 // range ~ [0, 2000]
    return Math.max(0, Math.min(1500, Math.round(vocab)))
  }
  if (stage === '初中') {
    vocab = 2000 + theta * 600 // range ~ [0, 4400]
    return Math.max(0, Math.min(4000, Math.round(vocab)))
  }
  if (stage === '高中') {
    vocab = 3500 + theta * 800 // range ~ [1100, 6700]
    return Math.max(0, Math.min(6500, Math.round(vocab)))
  }
  return Math.max(0, Math.min(12000, Math.round(vocab)))
}

// Result
app.get('/api/assessments/:sessionId/result', requireAuth, (req, res) => {
  const sessionId = req.params.sessionId
  const session = db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id)
  if (!session) {
    logEvent('warn', 'assessment_result_session_missing', requestMeta(req, { session_id: sessionId }))
    return res.status(404).json({ detail: 'session not found' })
  }

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
  const vocabScore = calcVocabScoreIRT(theta, session.stage)

  // Map vocabScore to CEFR
  let cefrLevel = 'A1 (入门)'
  let cefrDesc = '处于正在积累的阶段，词汇量还有很大提升空间，建议多加复习。'
  if (vocabScore >= 8000) { cefrLevel = 'C2 (精通)'; cefrDesc = '词汇量极其丰富，能够理解几乎所有形式的英语，包括复杂的学术或专业文章。' }
  else if (vocabScore >= 6000) { cefrLevel = 'C1 (高级)'; cefrDesc = '能够理解广泛的高难度长篇文章，能流利、自然地表达自己。' }
  else if (vocabScore >= 4000) { cefrLevel = 'B2 (中高)'; cefrDesc = '词汇量扎实，能听懂无字幕美剧的大部分日常对话，但在阅读长篇生僻文章时可能遇到阻碍。' }
  else if (vocabScore >= 2000) { cefrLevel = 'B1 (中级)'; cefrDesc = '表现不错！大部分基础词汇已经掌握，能应对日常交流，但生僻词还需巩固。' }
  else if (vocabScore >= 1000) { cefrLevel = 'A2 (初级)'; cefrDesc = '能够理解并使用一些基本的、日常的词汇和句子。' }

  logEvent('info', 'assessment_result_fetched', requestMeta(req, {
    session_id: sessionId,
    stage: session.stage,
    completed: ansCount,
    correct: correctCount,
    vocab_score: vocabScore,
    ended_by: session.ended_by || (session.ended_at ? 'completed' : 'ongoing'),
  }))

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
    ended_by: session.ended_by || (session.ended_at ? 'completed' : 'ongoing')
  })
})

app.get('/api/assessments/:sessionId/result/guest', (req, res) => {
  const sessionId = req.params.sessionId
  const guestId = String(req.headers['x-guest-id'] || '').trim()
  if (!guestId) return res.status(401).json({ detail: 'guest id required' })
  const session = db.prepare('SELECT * FROM assessment_sessions WHERE id = ? AND guest_id = ?').get(sessionId, guestId)
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
  const theta = estimateTheta(answers)
  const vocabScore = calcVocabScoreIRT(theta, session.stage)

  res.json({
    session_id: sessionId,
    stage: session.stage,
    total,
    completed: ansCount,
    correct: correctCount,
    vocab_score: vocabScore,
    cefr_level: vocabScore >= 4000 ? 'B2 (中高)' : vocabScore >= 2000 ? 'B1 (中级)' : 'A2 (初级)',
    cefr_desc: vocabScore >= 4000 ? '表现优秀，词汇基础较扎实。' : vocabScore >= 2000 ? '表现不错，基础词汇已经有一定掌握。' : '仍处于积累阶段，建议继续巩固基础词汇。',
    by_level: [],
    ended_by: session.ended_by || (session.ended_at ? 'completed' : 'ongoing')
  })
})

app.post('/api/guest/bind', requireAuth, (req, res) => {
  const guestId = String(req.body?.guest_id || '').trim()
  if (!guestId) return res.status(400).json({ detail: 'guest_id required' })
  db.prepare(`
    UPDATE assessment_sessions
    SET user_id = ?, guest_id = NULL
    WHERE guest_id = ? AND user_id IS NULL
  `).run(req.user.id, guestId)
  logEvent('info', 'guest_sessions_bound', requestMeta(req, { guest_id: guestId }))
  res.json({ ok: true })
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
      vocab_score: calcVocabScoreIRT(theta, s.stage)
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
    const score = calcVocabScoreIRT(theta, s.stage)
    
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

app.get('/api/words/:id/related', (req, res) => {
  const id = String(req.params.id || '').trim()
  const wordRow = db.prepare(`
    SELECT id, word, meaning_zh, phonetic, pos, stage, level
    FROM words
    WHERE id = ?
  `).get(id)
  if (!wordRow) return res.status(404).json({ detail: 'word not found' })

  const pool = db.prepare(`
    SELECT id, word, meaning_zh, phonetic, pos, stage, level
    FROM words
    WHERE id != ? AND (stage = ? OR pos = ?)
    LIMIT 400
  `).all(wordRow.id, wordRow.stage, wordRow.pos || '')

  const related = findRelatedWords({ wordRow, pool, limit: 6 })
  res.json(related)
})

app.get('/api/words/:id/contrast/:otherId', (req, res) => {
  const baseId = String(req.params.id || '').trim()
  const otherId = String(req.params.otherId || '').trim()
  const baseWord = db.prepare(`
    SELECT id, word, meaning_zh, phonetic, pos, stage, level
    FROM words WHERE id = ?
  `).get(baseId)
  const otherWord = db.prepare(`
    SELECT id, word, meaning_zh, phonetic, pos, stage, level
    FROM words WHERE id = ?
  `).get(otherId)
  if (!baseWord || !otherWord) {
    return res.status(404).json({ detail: 'word not found' })
  }

  const analysis = buildContrastAnalysis(baseWord, otherWord)
  res.json({
    base_word: baseWord,
    target_word: otherWord,
    ...analysis,
  })
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
    const rng = createRng()
    const question = createQuestionSnapshot({
      userId: req.user.id,
      scope: 'srs',
      sourceId: wordRow.srs_id,
      question: buildSingleMcq({ wordRow, pool, rng }),
    })
    return { srs_id: wordRow.srs_id, box_level: wordRow.box_level, question }
  })

  logEvent('info', 'srs_today_fetched', requestMeta(req, { task_count: tasks.length }))
  res.json(tasks)
})

// Submit SRS Review Answer
app.post('/api/srs/review', requireAuth, (req, res) => {
  const { srs_id, question_id, choice_index } = req.body
  const now = Date.now()
  const streakDays = touchUserActivity(db, req.user.id, now, 'review')
  const item = db.prepare('SELECT * FROM spaced_repetition_items WHERE id = ? AND user_id = ?').get(srs_id, req.user.id)
  logEvent('info', 'srs_review_received', requestMeta(req, {
    srs_id: srs_id || null,
    question_snapshot_id: question_id || null,
    choice_index: choice_index ?? null,
  }))
  if (!item) {
    logEvent('warn', 'srs_review_item_missing', requestMeta(req, { srs_id: srs_id || null }))
    return res.status(404).json({ detail: 'srs item not found' })
  }

  const snapshot = db.prepare(`
    SELECT *
    FROM question_snapshots
    WHERE id = ? AND user_id = ? AND source_id = ? AND scope = 'srs'
  `).get(String(question_id || '').trim(), req.user.id, srs_id)
  if (!snapshot) {
    logEvent('warn', 'srs_review_snapshot_missing', requestMeta(req, { srs_id, question_snapshot_id: question_id || null }))
    return res.status(400).json({ detail: 'review snapshot not found' })
  }
  if (snapshot.answered_at) {
    logEvent('warn', 'srs_review_duplicate_submission', requestMeta(req, { srs_id, question_snapshot_id: question_id || null }))
    return res.status(400).json({ detail: 'review question already answered' })
  }

  const isCorrect = Number(choice_index) === snapshot.answer_index

  let newBox = item.box_level
  if (isCorrect) {
    newBox = Math.min(item.box_level + 1, 7) // Max box level 7
  } else {
    newBox = 1 // Drop to box 1 if failed
  }

  const nextReviewAt = getReviewAtByBox(newBox, now)

  db.prepare('UPDATE spaced_repetition_items SET box_level = ?, next_review_at = ?, updated_at = ? WHERE id = ?').run(
    newBox, nextReviewAt, now, srs_id
  )
  db.prepare('UPDATE question_snapshots SET answered_at = ? WHERE id = ?').run(now, snapshot.id)

  let addedExp = 0
  if (isCorrect) {
    const rules = getActiveRuleset()
    addedExp = Number(rules.review_exp_correct || 5)
    db.prepare('UPDATE users SET exp = exp + ? WHERE id = ?').run(addedExp, req.user.id)
  }

  const unlocked = evaluateAchievements(db, req.user.id, now)
  const summary = getUserProgressSummary(db, req.user.id)

  logEvent('info', 'srs_review_judged', requestMeta(req, {
    srs_id,
    question_snapshot_id: question_id || null,
    selected_index: Number(choice_index),
    correct_index: snapshot.answer_index,
    is_correct: isCorrect,
    new_box: newBox,
    next_review_at: nextReviewAt,
    added_exp: addedExp,
    streak_days: streakDays,
  }))
  res.json({
    ok: true,
    box_level: newBox,
    next_review_at: nextReviewAt,
    added_exp: addedExp,
    current_exp: summary.exp,
    streak_days: summary.streak_days,
    new_achievements: unlocked,
  })
})

app.get('/api/users/me/exp', requireAuth, (req, res) => {
  const user = db.prepare('SELECT exp FROM users WHERE id = ?').get(req.user.id)
  logEvent('info', 'user_exp_fetched', requestMeta(req, { exp: user ? user.exp : 0 }))
  res.json({ exp: user ? user.exp : 0 })
})

app.get('/api/users/me/progress', requireAuth, (req, res) => {
  const summary = getUserProgressSummary(db, req.user.id)
  logEvent('info', 'user_progress_fetched', requestMeta(req, {
    exp: summary.exp,
    streak_days: summary.streak_days,
    achievement_count: summary.achievement_count,
  }))
  res.json(summary)
})

app.get('/api/users/me/achievements', requireAuth, (req, res) => {
  const achievements = getUserAchievements(db, req.user.id)
  logEvent('info', 'user_achievements_fetched', requestMeta(req, { count: achievements.length }))
  res.json(achievements)
})

const port = Number(process.env.PORT || 8000)
app.listen(port, () => {
  process.stdout.write(`WordGauge API listening on http://localhost:${port}\n`)
})
