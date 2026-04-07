import cors from 'cors'
import express from 'express'
import path from 'node:path'

import { buildQuiz, summarizeByLevel } from './assessment.js'
import { loadLexicon } from './lexicon.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true)
      if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true,
  }),
)

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const lexicon = loadLexicon(projectRoot)
const rng = mulberry32(7)
const sessions = new Map()

app.get('/health', (req, res) => {
  res.json({ ok: true, words: lexicon.length })
})

app.post('/api/assessments/start', (req, res) => {
  const stage = String(req.body?.stage || '').trim()
  const perLevelCount = Number(req.body?.per_level_count ?? 4)
  if (!stage) return res.status(400).json({ detail: 'stage required' })
  if (!Number.isFinite(perLevelCount) || perLevelCount <= 0) {
    return res.status(400).json({ detail: 'per_level_count invalid' })
  }

  let questions
  try {
    questions = buildQuiz({ stage, perLevelCount, items: lexicon, rng })
  } catch (e) {
    const statusCode = e?.statusCode || 500
    return res.status(statusCode).json({ detail: String(e?.message || e) })
  }

  const sessionId = `s${sessions.size + 1}`
  sessions.set(sessionId, { stage, questions, answers: [], endedBy: 'quota' })
  const q0 = questions[0]
  res.json({
    session_id: sessionId,
    question: toQuestionOut(q0),
    total: questions.length,
  })
})

app.post('/api/assessments/:sessionId/answer', (req, res) => {
  const sessionId = req.params.sessionId
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ detail: 'session not found' })

  const idx = s.answers.length
  if (idx >= s.questions.length) {
    return res.json({ done: true, question: null, progress: s.answers.length, total: s.questions.length })
  }

  const questionId = String(req.body?.question_id || '').trim()
  const choiceIndex = Number(req.body?.choice_index)
  const q = s.questions[idx]
  if (q.id !== questionId) return res.status(400).json({ detail: 'question mismatch' })
  if (!Number.isFinite(choiceIndex) || choiceIndex < 0 || choiceIndex >= q.options.length) {
    return res.status(400).json({ detail: 'choice_index out of range' })
  }

  s.answers.push(choiceIndex)
  const idx2 = s.answers.length
  if (idx2 >= s.questions.length) {
    return res.json({ done: true, question: null, progress: idx2, total: s.questions.length })
  }
  res.json({ done: false, question: toQuestionOut(s.questions[idx2]), progress: idx2, total: s.questions.length })
})

app.get('/api/assessments/:sessionId/result', (req, res) => {
  const sessionId = req.params.sessionId
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ detail: 'session not found' })

  let correct = 0
  for (let i = 0; i < s.answers.length; i += 1) {
    if (s.answers[i] === s.questions[i].answerIndex) correct += 1
  }

  const byLevel = summarizeByLevel(s.questions, s.answers)
  res.json({
    session_id: sessionId,
    stage: s.stage,
    total: s.questions.length,
    completed: s.answers.length,
    correct,
    ended_by: s.endedBy,
    by_level: byLevel,
  })
})

function toQuestionOut(q) {
  return { id: q.id, stem: q.stem, options: q.options, level: q.level, kind: q.kind }
}

const port = Number(process.env.PORT || 8000)
app.listen(port, () => {
  process.stdout.write(`WordGauge API listening on http://localhost:${port}\n`)
})
