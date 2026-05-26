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
  guest_id?: string
}

export type StartAssessmentOut = {
  session_id: string
  guest_id?: string | null
  question: ApiQuestion
  total: number
  progress?: number
}

export type AnswerIn = {
  question_id: string
  choice_index: number
  time_spent_ms?: number
}

export type AnswerOut = {
  done: boolean
  question: ApiQuestion | null
  progress: number
  total: number
  ended_by?: string
  added_exp?: number
  current_exp?: number
  streak_days?: number
  new_achievements?: Array<{ code: string; title: string; description: string; icon: string }>
}

export type ResultOut = {
  session_id: string
  stage: string
  total: number
  completed: number
  correct: number
  vocab_score?: number
  cefr_level?: string
  cefr_desc?: string
  by_level: Array<{ level: string; total: number; correct: number }>
  ended_by: string
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
      const refreshToken = localStorage.getItem('wordgauge-refresh-token')
      const isRefreshEndpoint = url.includes('/api/auth/refresh')
      if (refreshToken && !isRefreshEndpoint) {
        try {
          await refreshLogin()
          return json<T>(url, init)
        } catch {
          localStorage.removeItem('wordgauge-token')
          localStorage.removeItem('wordgauge-refresh-token')
          window.location.href = '/auth'
        }
      } else {
        localStorage.removeItem('wordgauge-token')
        localStorage.removeItem('wordgauge-refresh-token')
        window.location.href = '/auth'
      }
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
  const r = await json<{ token: string; refresh_token?: string; user?: UserMe }>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  localStorage.setItem('wordgauge-token', r.token)
  if (r.refresh_token) {
    localStorage.setItem('wordgauge-refresh-token', r.refresh_token)
  }
  return r
}

export async function login(username: string, password: string) {
  const r = await json<{ token: string; refresh_token?: string; user?: UserMe }>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  localStorage.setItem('wordgauge-token', r.token)
  if (r.refresh_token) {
    localStorage.setItem('wordgauge-refresh-token', r.refresh_token)
  }
  return r
}

export async function refreshLogin() {
  const refreshToken = localStorage.getItem('wordgauge-refresh-token')
  if (!refreshToken) throw new Error('missing refresh token')
  const r = await json<{ token: string; refresh_token: string; user?: UserMe }>(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  localStorage.setItem('wordgauge-token', r.token)
  localStorage.setItem('wordgauge-refresh-token', r.refresh_token)
  return r
}

export async function logoutServer() {
  const refreshToken = localStorage.getItem('wordgauge-refresh-token')
  await json<{ ok: true }>(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export function logout() {
  localStorage.removeItem('wordgauge-token')
  localStorage.removeItem('wordgauge-refresh-token')
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

export async function answerGuest(sessionId: string, guestId: string, body: AnswerIn) {
  return json<AnswerOut>(`${API_BASE}/api/assessments/${sessionId}/answer`, {
    method: 'POST',
    headers: {
      'X-Guest-Id': guestId,
    },
    body: JSON.stringify({ ...body, guest_id: guestId }),
  })
}

export async function getResult(sessionId: string) {
  return json<ResultOut>(`${API_BASE}/api/assessments/${sessionId}/result`)
}

export async function getGuestResult(sessionId: string, guestId: string) {
  return json<ResultOut>(`${API_BASE}/api/assessments/${sessionId}/result/guest`, {
    headers: {
      'X-Guest-Id': guestId,
    },
  })
}

export type SrsReviewTask = {
  srs_id: string
  box_level: number
  question: ApiQuestion
}

export async function getTodayReview() {
  return json<SrsReviewTask[]>(`${API_BASE}/api/srs/today`)
}

export async function submitReview(srs_id: string, question_id: string, choice_index: number) {
  return json<{
    ok: boolean
    box_level: number
    next_review_at: number
    added_exp?: number
    current_exp?: number
    streak_days?: number
    new_achievements?: Array<{ code: string; title: string; description: string; icon: string }>
  }>(`${API_BASE}/api/srs/review`, {
    method: 'POST',
    body: JSON.stringify({ srs_id, question_id, choice_index }),
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

export type RelatedWordEntry = {
  id: string
  word: string
  meaning_zh: string
  phonetic: string | null
  pos: string | null
  stage: string | null
  level?: string | null
  similarity_score: number
  reason: string
}

export type WordContrastOut = {
  base_word: WordEntry
  target_word: WordEntry
  similarity_score: number
  reason: string
  bullets: string[]
  memory_tip: string
}

export async function searchWords(q: string) {
  return json<WordEntry[]>(`${API_BASE}/api/words/search?q=${encodeURIComponent(q)}`)
}

export async function getMistakes() {
  return json<WordEntry[]>(`${API_BASE}/api/users/me/mistakes`)
}

export async function getRelatedWords(wordId: string) {
  return json<RelatedWordEntry[]>(`${API_BASE}/api/words/${wordId}/related`)
}

export async function getWordContrast(wordId: string, otherId: string) {
  return json<WordContrastOut>(`${API_BASE}/api/words/${wordId}/contrast/${otherId}`)
}

export type UserMe = {
  id: string
  username: string
  exp: number
  role?: string
  streak_days?: number
  achievement_count?: number
}

export async function getMe() {
  return json<UserMe>(`${API_BASE}/api/auth/me`)
}

export async function getUserExp() {
  return json<{ exp: number }>(`${API_BASE}/api/users/me/exp`)
}

export type UserProgressSummary = {
  exp: number
  streak_days: number
  last_active_at?: number | null
  achievement_count: number
  latest_achievements: Array<{ code: string; title: string; description: string; icon: string; unlocked_at: number; rarity: string; category: string }>
  recent_activity_days: Array<{ day_key: number; source: string }>
}

export async function getUserProgress() {
  return json<UserProgressSummary>(`${API_BASE}/api/users/me/progress`)
}

export type UserAchievement = {
  id: string
  code: string
  title: string
  description: string
  icon: string
  rarity: string
  category: string
  unlocked_at?: number | null
  unlocked: boolean
  progress_current: number
  progress_target: number
  progress_label: string
}

export async function getUserAchievements() {
  return json<UserAchievement[]>(`${API_BASE}/api/users/me/achievements`)
}

export async function bindGuestToUser(guestId: string) {
  return json<{ ok: true }>(`${API_BASE}/api/guest/bind`, {
    method: 'POST',
    body: JSON.stringify({ guest_id: guestId }),
  })
}

export async function getAdminRulesets() {
  return json<Array<{ id: string; name: string; is_active: number; config: Record<string, unknown>; created_at: number; updated_at: number }>>(
    `${API_BASE}/api/admin/rulesets`
  )
}

export async function createAdminRuleset(name: string, config: Record<string, unknown>) {
  return json<{ ok: true; id: string }>(`${API_BASE}/api/admin/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ name, config }),
  })
}

export async function activateAdminRuleset(id: string) {
  return json<{ ok: true }>(`${API_BASE}/api/admin/rulesets/${id}/activate`, {
    method: 'POST',
  })
}
