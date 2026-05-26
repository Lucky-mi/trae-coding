import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { answer, answerGuest, getGuestResult, getResult, startAssessment } from '../api/client'
import type { ApiQuestion } from '../api/client'
import AppShell from '../components/AppShell'
import AchievementPopup from '../components/AchievementPopup'
import EvolutionModal from '../components/EvolutionModal'
import GardenCollectionPopup from '../components/GardenCollectionPopup'
import { getPlantStageInfo } from '../components/ExpPlant'

type QuizSetupState = {
  stage: '小学' | '初中' | '高中'
  perLevelCount: number
  timeLimitSec: number | null
  adaptive: boolean
  guestId?: string
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

import { useAuth } from '../store/useAuth'
import { getUserExp } from '../api/client'
import { getPlantCycleExp, PLANT_MILESTONE_EXP, useSession } from '../store/useSession'
import type { GardenPlant, SessionState } from '../store/useSession'

export default function QuizPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUserProgress } = useAuth()
  const sessionGuestId = useSession((s: SessionState) => s.guestId)
  const collectMaturePlants = useSession((s: SessionState) => s.collectMaturePlants)
  const setup = (location.state || {
    stage: '小学',
    perLevelCount: 4,
    timeLimitSec: 15 * 60,
    adaptive: true,
    guestId: sessionGuestId,
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

  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())

  useEffect(() => {
    if (question) {
      setQuestionStartTime(Date.now())
    }
  }, [question])

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
          guest_id: user ? undefined : (setup.guestId || sessionGuestId),
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
        const guestResult = user ? r : await getGuestResult(sessionId, setup.guestId || sessionGuestId)
        navigate('/result', {
          replace: true,
          state: {
            setup,
            sessionId,
            guestId: user ? undefined : (setup.guestId || sessionGuestId),
            total: guestResult.total,
            completed: guestResult.completed,
            correct: guestResult.correct,
            byLevel: guestResult.by_level,
            endedBy: 'time',
            cefrLevel: guestResult.cefr_level,
            cefrDesc: guestResult.cefr_desc,
          },
        })
      })()
    }
  }, [navigate, remainingSec, sessionId, setup])

  async function playTTS(text: string) {
    if (!('speechSynthesis' in window)) return
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    gsap.fromTo(
      el,
      { opacity: 0, y: 18, rotateX: 8, transformPerspective: 800 },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.4, ease: 'power2.out' },
    )
    if (question?.word) {
      playTTS(question.word)
    }

    // Options stagger animation
    if (optionRefs.current.length > 0) {
      gsap.fromTo(
        optionRefs.current.filter(Boolean),
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out', delay: 0.1 }
      )
    }
  }, [progress, question?.id])

  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [rewardToast, setRewardToast] = useState<{ exp: number; achievements: string[] } | null>(null)
  const [evolution, setEvolution] = useState<{ prevExp: number; nextExp: number } | null>(null)
  const [gardenReward, setGardenReward] = useState<GardenPlant[] | null>(null)

  async function choose(optionIndex: number) {
    if (!sessionId || !question || submitting) return
    setSelectedOpt(optionIndex)
    setShowFeedback(true)

    const opt = optionRefs.current[optionIndex]
    if (opt) {
      gsap.to(opt, {
        scale: 0.96,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      })
    }
    setSubmitting(true)
    
    // Add artificial delay for visual feedback to be seen
    await new Promise(r => setTimeout(r, 400))

    try {
      const answerBody = {
        question_id: question.id,
        choice_index: optionIndex,
        time_spent_ms: Date.now() - questionStartTime
      }
      const r = user
        ? await answer(sessionId, answerBody)
        : await answerGuest(sessionId, setup.guestId || sessionGuestId, answerBody)
      const beforeExp = user?.exp || 0
      const afterExp = r.current_exp ?? beforeExp
      const beforeCycleExp = getPlantCycleExp(beforeExp)
      const afterCycleExp = getPlantCycleExp(afterExp)
      const crossedMilestone = Math.floor(afterExp / PLANT_MILESTONE_EXP) > Math.floor(beforeExp / PLANT_MILESTONE_EXP)
      if (user && !crossedMilestone && getPlantStageInfo(afterCycleExp).level > getPlantStageInfo(beforeCycleExp).level) {
        setEvolution({ prevExp: beforeCycleExp, nextExp: afterCycleExp })
        window.setTimeout(() => setEvolution(null), 2400)
      }
      if (user) {
        const collectedPlants = collectMaturePlants(afterExp)
        if (collectedPlants.length > 0) {
          setGardenReward(collectedPlants)
          window.setTimeout(() => setGardenReward(null), 3200)
        }
      }
      if (user && ((r.added_exp || 0) > 0 || (r.new_achievements?.length || 0) > 0)) {
        setRewardToast({
          exp: r.added_exp || 0,
          achievements: (r.new_achievements || []).map((item) => item.title),
        })
        window.setTimeout(() => setRewardToast(null), 2200)
      }
      if (user && (r.current_exp != null || r.streak_days != null)) {
        setUserProgress({
          exp: r.current_exp ?? user.exp,
          streak_days: r.streak_days ?? user.streak_days,
          achievement_count: user.achievement_count ? user.achievement_count + (r.new_achievements?.length || 0) : undefined,
        })
      }
      setProgress(r.progress)
      setTotal(r.total)
      if (!r.question) {
        const result = user
          ? await getResult(sessionId)
          : await getGuestResult(sessionId, setup.guestId || sessionGuestId)
        if (user) {
          try {
            const expData = await getUserExp()
            setUserProgress({ exp: expData.exp })
          } catch(e) {}
        }
        
        navigate('/result', {
          state: {
            setup,
            sessionId,
            guestId: user ? undefined : (setup.guestId || sessionGuestId),
            total: result.total,
            completed: result.completed,
            correct: result.correct,
            byLevel: result.by_level,
            endedBy: r.ended_by || (r.progress >= r.total ? 'quota' : 'converge'),
            cefrLevel: result.cefr_level,
            cefrDesc: result.cefr_desc,
          },
        })
        return
      }
      setShowFeedback(false)
      setSelectedOpt(null)
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
        {evolution ? <EvolutionModal prevExp={evolution.prevExp} nextExp={evolution.nextExp} /> : null}
        {gardenReward ? <GardenCollectionPopup plants={gardenReward} /> : null}
        {rewardToast ? <AchievementPopup exp={rewardToast.exp} achievements={rewardToast.achievements} /> : null}
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

          <div className="mt-4 flex flex-col items-center justify-center py-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                {question.word}
              </span>
              <button
                onClick={() => playTTS(question.word)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-brand-300 transition hover:bg-white/10 hover:text-brand-200"
                title="播放发音"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                  <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                </svg>
              </button>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              {question.phonetic && (
                <span className="font-mono text-sm text-white/50">
                  /{question.phonetic}/
                </span>
              )}
              {question.pos && (
                <span className="rounded bg-brand-500/20 px-2 py-0.5 text-xs font-semibold text-brand-300">
                  {question.pos}.
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            {question.options.map((opt, i) => {
              const isSelected = selectedOpt === i
              const isCorrectAnswer = i === question.answerIndex
              
              let btnClass = "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
              let iconColor = "text-white/45"
              
              if (showFeedback) {
                if (isCorrectAnswer) {
                  btnClass = "group relative overflow-hidden rounded-2xl border border-emerald-500/50 bg-emerald-500/20 px-5 py-4 text-left text-sm font-semibold text-white transition disabled:opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  iconColor = "text-emerald-400"
                } else if (isSelected && !isCorrectAnswer) {
                  btnClass = "group relative overflow-hidden rounded-2xl border border-rose-500/50 bg-rose-500/20 px-5 py-4 text-left text-sm font-semibold text-white transition disabled:opacity-100 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  iconColor = "text-rose-400"
                } else {
                  btnClass = "group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 px-5 py-4 text-left text-sm font-semibold text-white/40 transition disabled:opacity-40"
                }
              }

              return (
                <button
                  key={`${opt}-${i}`}
                  type="button"
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  onClick={() => choose(i)}
                  disabled={submitting}
                  className={btnClass}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                    <div className="absolute -inset-10 bg-gradient-to-r from-brand-500/10 to-fuchsia-500/10 blur-xl" />
                  </div>
                  <div className="relative flex items-center justify-between gap-4">
                    <span>{opt}</span>
                    <span className={`text-xs font-semibold ${iconColor}`}>
                      {showFeedback && isCorrectAnswer ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 scale-0 animate-[pop_0.3s_ease-out_forwards]">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      ) : showFeedback && isSelected && !isCorrectAnswer ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 scale-0 animate-[pop_0.3s_ease-out_forwards]">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        String.fromCharCode(65 + i)
                      )}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
