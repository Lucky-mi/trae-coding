import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { getTodayReview, submitReview } from '../api/client'
import type { SrsReviewTask } from '../api/client'
import AppShell from '../components/AppShell'

export default function ReviewPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<SrsReviewTask[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState(false)
  const [lastBoxLevel, setLastBoxLevel] = useState<number | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getTodayReview()
      .then((data) => {
        setTasks(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const currentTask = tasks[currentIndex]

  async function playTTS(text: string) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const el = cardRef.current
    if (!el || !currentTask) return
    gsap.fromTo(
      el,
      { opacity: 0, y: 18, rotateX: 8, transformPerspective: 800 },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.4, ease: 'power2.out' },
    )
    playTTS(currentTask.question.word)
  }, [currentIndex, currentTask])

  async function handleOptionClick(optionIndex: number) {
    if (answering || !currentTask) return
    setAnswering(true)

    const isCorrect = optionIndex === currentTask.question.answerIndex
    setLastCorrect(isCorrect)

    try {
      const res = await submitReview(currentTask.srs_id, isCorrect)
      setLastBoxLevel(res.box_level)

      // 简单答题反馈特效
      if (isCorrect) {
        gsap.to(cardRef.current, { scale: 1.02, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      } else {
        gsap.to(cardRef.current, { x: 10, duration: 0.05, yoyo: true, repeat: 5, ease: 'power1.inOut' })
      }

      setTimeout(() => {
        setAnswering(false)
        setLastCorrect(null)
        setCurrentIndex((prev) => prev + 1)
      }, 800)
    } catch (err) {
      console.error(err)
      setAnswering(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center text-white/50">
          加载今日复习任务中...
        </div>
      </AppShell>
    )
  }

  if (currentIndex >= tasks.length) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl text-center py-20">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-10 w-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">今日复习任务已完成！</h2>
          <p className="text-white/60 mb-8">
            你一共复习了 {tasks.length} 个单词，遗忘曲线正在被你一步步战胜。明天记得再来！
          </p>
          <button
            onClick={() => navigate('/dictionary')}
            className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-8 py-3 font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            返回词汇中心
          </button>
        </div>
      </AppShell>
    )
  }

  const { question } = currentTask

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm font-medium text-white/50">
            艾宾浩斯复习进度
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-500/20 px-2 py-1 text-xs font-semibold text-brand-300">
              {currentIndex + 1} / {tasks.length}
            </span>
          </div>
        </div>

        <div
          ref={cardRef}
          className="rounded-[2rem] border border-white/10 bg-panel-900 p-8 shadow-glow backdrop-blur md:p-12"
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-white/40">当前记忆等级：Box {currentTask.box_level}</div>
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
              const isSelected = answering && lastCorrect !== null
              const isCorrectOpt = i === question.answerIndex
              let btnClass = 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
              
              if (isSelected) {
                if (isCorrectOpt) {
                  btnClass = 'border-green-500/50 bg-green-500/20 text-green-300'
                } else if (!lastCorrect) {
                  btnClass = 'border-red-500/50 bg-red-500/20 text-red-300 opacity-50'
                } else {
                  btnClass = 'border-white/10 bg-white/5 text-white/40 opacity-50'
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleOptionClick(i)}
                  disabled={answering}
                  className={`flex w-full items-center justify-between rounded-xl border px-6 py-4 text-left font-medium transition ${btnClass}`}
                >
                  <span>{opt}</span>
                  <span className="text-sm opacity-50">
                    {['A', 'B', 'C', 'D'][i]}
                  </span>
                </button>
              )
            })}
          </div>
          
          {lastCorrect !== null && (
            <div className={`mt-6 text-center text-sm font-semibold ${lastCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {lastCorrect 
                ? `回答正确！记忆等级提升至 Box ${lastBoxLevel}` 
                : '回答错误。该词已被重置回 Box 1，明天继续复习！'}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
