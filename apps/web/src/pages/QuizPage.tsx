import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { answer, getResult, startAssessment } from '../api/client'
import type { ApiQuestion } from '../api/client'
import AppShell from '../components/AppShell'

type QuizSetupState = {
  stage: '小学' | '初中' | '高中'
  perLevelCount: number
  timeLimitSec: number | null
  adaptive: boolean
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function QuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setup = (location.state || {
    stage: '小学',
    perLevelCount: 4,
    timeLimitSec: 15 * 60,
    adaptive: true,
  }) as QuizSetupState

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [question, setQuestion] = useState<ApiQuestion | null>(null)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [remainingSec, setRemainingSec] = useState<number | null>(
    setup.timeLimitSec,
  )

  const cardRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const r = await startAssessment({
          stage: setup.stage,
          per_level_count: setup.perLevelCount,
          adaptive: setup.adaptive,
          time_limit_sec: setup.timeLimitSec,
        })
        if (cancelled) return
        setSessionId(r.session_id)
        setQuestion(r.question)
        setTotal(r.total)
        setProgress(0)
      } catch (e) {
        if (cancelled) return
        setError(String(e instanceof Error ? e.message : e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [setup.adaptive, setup.perLevelCount, setup.stage, setup.timeLimitSec])

  const progressPercent = total > 0 ? (progress / total) * 100 : 0

  useEffect(() => {
    if (remainingSec == null) return
    const t = window.setInterval(() => {
      setRemainingSec((v) => (v == null ? v : v - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [remainingSec])

  useEffect(() => {
    if (remainingSec != null && remainingSec <= 0 && sessionId) {
      ;(async () => {
        const r = await getResult(sessionId)
        navigate('/result', {
          replace: true,
          state: {
            setup,
            total: r.total,
            completed: r.completed,
            correct: r.correct,
            byLevel: r.by_level,
            endedBy: 'time',
          },
        })
      })()
    }
  }, [navigate, remainingSec, sessionId, setup])

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    gsap.fromTo(
      el,
      { opacity: 0, y: 18, rotateX: 8, transformPerspective: 800 },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.4, ease: 'power2.out' },
    )
  }, [progress, question?.id])

  async function choose(optionIndex: number) {
    if (!sessionId || !question || submitting) return
    const opt = optionRefs.current[optionIndex]
    if (opt) {
      gsap.to(opt, {
        scale: 0.98,
        duration: 0.08,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      })
    }
    setSubmitting(true)
    try {
      const r = await answer(sessionId, {
        question_id: question.id,
        choice_index: optionIndex,
      })
      setProgress(r.progress)
      setTotal(r.total)
      if (r.done) {
        const result = await getResult(sessionId)
        navigate('/result', {
          state: {
            setup,
            total: result.total,
            completed: result.completed,
            correct: result.correct,
            byLevel: result.by_level,
            endedBy: 'quota',
          },
        })
        return
      }
      setQuestion(r.question)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur md:p-8">
            <div className="text-sm font-semibold text-white/85">正在生成题目</div>
            <div className="mt-2 text-xs text-white/55">读取 xlsx 词库并按配额抽题</div>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[38%] rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !question) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur md:p-8">
            <div className="text-sm font-semibold text-white/85">题库服务不可用</div>
            <div className="mt-2 break-words text-xs text-white/55">{error}</div>
            <div className="mt-6 text-xs text-white/55">
              确认本地 API 已启动：http://localhost:8000/health
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/65">
            {setup.stage} · 配额模式{setup.adaptive ? ' + 自适应' : ''}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-panel-900 px-4 py-2 text-xs text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            <span>
              进度 {Math.min(progress + 1, total || 1)} / {total || 1}
            </span>
            {remainingSec != null ? (
              <span className="text-white/45">· {formatTime(remainingSec)}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400 transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div
          ref={cardRef}
          className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur md:p-8"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-white/50">{question.level || setup.stage}</div>
            <div className="text-xs text-white/50">{sessionId}</div>
          </div>

          <div className="mt-3 text-balance text-2xl font-semibold leading-tight text-white md:text-3xl">
            {question.stem}
          </div>

          <div className="mt-6 grid gap-3">
            {question.options.map((opt, i) => (
              <button
                key={`${opt}-${i}`}
                type="button"
                ref={(el) => {
                  optionRefs.current[i] = el
                }}
                onClick={() => choose(i)}
                disabled={submitting}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute -inset-10 bg-gradient-to-r from-brand-500/10 to-fuchsia-500/10 blur-xl" />
                </div>
                <div className="relative flex items-center justify-between gap-4">
                  <span>{opt}</span>
                  <span className="text-xs font-semibold text-white/45">
                    {String.fromCharCode(65 + i)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
