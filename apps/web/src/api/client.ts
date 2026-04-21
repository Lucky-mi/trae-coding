const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

export type ApiQuestion = {
  id: string
  word: string
  phonetic: string | null
  pos: string | null
  options: string[]
  answerIndex: number
  level: string | null
  kind: string
}

export type StartAssessmentIn = {
  stage: string
  per_level_count: number
  adaptive: boolean
  time_limit_sec: number | null
}

export type StartAssessmentOut = {
  session_id: string
  question: ApiQuestion
  total: number
}

export type AnswerIn = {
  question_id: string
  choice_index: number
  is_correct: boolean
}

export type AnswerOut = {
  done: boolean
  question: ApiQuestion | null
  progress: number
  total: number
}

export type ResultOut = {
  session_id: string
  stage: string
  total: number
  completed: number
  correct: number
  vocab_score: number
  ended_by: string
  by_level: Array<{ level: string; total: number; correct: number }>
}

export async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('wordgauge-token')
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...init,
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401) {
      localStorage.removeItem('wordgauge-token')
      window.location.href = '/auth'
    }
    try {
      const err = JSON.parse(text)
      throw new Error(err.detail || err.message || `HTTP ${res.status}`)
    } catch {
      throw new Error(text || `HTTP ${res.status}`)
    }
  }
  return (await res.json()) as T
}

export async function register(username: string, password: string) {
  const r = await json<{ token: string }>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  localStorage.setItem('wordgauge-token', r.token)
  return r
}

export async function login(username: string, password: string) {
  const r = await json<{ token: string }>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  localStorage.setItem('wordgauge-token', r.token)
  return r
}

export function logout() {
  localStorage.removeItem('wordgauge-token')
  window.location.href = '/auth'
}

export async function startAssessment(body: StartAssessmentIn) {
  return json<StartAssessmentOut>(`${API_BASE}/api/assessments/start`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function answer(sessionId: string, body: AnswerIn) {
  return json<AnswerOut>(`${API_BASE}/api/assessments/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getResult(sessionId: string) {
  return json<ResultOut>(`${API_BASE}/api/assessments/${sessionId}/result`)
}

export type SrsReviewTask = {
  srs_id: string
  box_level: number
  question: ApiQuestion
}

export async function getTodayReview() {
  return json<SrsReviewTask[]>(`${API_BASE}/api/srs/today`)
}

export async function submitReview(srs_id: string, is_correct: boolean) {
  return json<{ ok: boolean; box_level: number; next_review_at: number }>(`${API_BASE}/api/srs/review`, {
    method: 'POST',
    body: JSON.stringify({ srs_id, is_correct }),
  })
}

export type HistorySession = {
  id: string
  stage: string
  created_at: number
  total: number
  correct: number
  vocab_score: number
  status: string
}

export async function getHistory() {
  return json<HistorySession[]>(`${API_BASE}/api/users/me/history`)
}

export type LeaderboardEntry = {
  username: string
  vocab_score: number
  stage: string
  created_at: number
}

export async function getLeaderboard(stage?: string) {
  const url = stage ? `${API_BASE}/api/leaderboard?stage=${encodeURIComponent(stage)}` : `${API_BASE}/api/leaderboard`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load leaderboard')
  return (await res.json()) as LeaderboardEntry[]
}

export type WordEntry = {
  id: string
  word: string
  meaning_zh: string
  phonetic: string
  pos: string
  stage: string
  level?: string
  fail_count?: number
  last_failed_at?: number
}

export async function searchWords(q: string) {
  return json<WordEntry[]>(`${API_BASE}/api/words/search?q=${encodeURIComponent(q)}`)
}

export async function getMistakes() {
  return json<WordEntry[]>(`${API_BASE}/api/users/me/mistakes`)
}

export type UserMe = {
  id: string
  username: string
}

export async function getMe() {
  return json<UserMe>(`${API_BASE}/api/auth/me`)
}

