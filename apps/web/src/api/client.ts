const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

export type ApiQuestion = {
  id: string
  stem: string
  options: string[]
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
  ended_by: string
  by_level: Array<{ level: string; total: number; correct: number }>
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
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

