import * as echarts from 'echarts'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useSession } from '../store/useSession'
import type { SessionState } from '../store/useSession'
import { getGuestResult, getResult, getUserAchievements, getUserProgress } from '../api/client'
import type { ResultOut, UserAchievement, UserProgressSummary } from '../api/client'
import { useAuth } from '../store/useAuth'

type ResultState = {
  sessionId?: string
  guestId?: string
  setup?: {
    stage: string
    perLevelCount: number
    timeLimitSec: number | null
    adaptive: boolean
  }
  total: number
  completed: number
  correct: number
  byLevel: Array<{ level: string; total: number; correct: number }>
  endedBy: string
  cefrLevel?: string
  cefrDesc?: string
}

export default function ResultPage() {
  const location = useLocation()
  const state = location.state as ResultState | null
  const addRecord = useSession((s: SessionState) => s.addRecord)
  const { user } = useAuth()

  const [remoteData, setRemoteData] = useState<ResultOut | null>(null)
  const [progress, setProgress] = useState<UserProgressSummary | null>(null)
  const [nextAchievement, setNextAchievement] = useState<UserAchievement | null>(null)

  useEffect(() => {
    if (state?.sessionId) {
      const task = state.guestId
        ? getGuestResult(state.sessionId, state.guestId)
        : getResult(state.sessionId)
      task.then((res) => {
        setRemoteData(res)
      }).catch(err => {
        console.error(err)
      })
    }
  }, [state?.sessionId, state?.guestId])

  useEffect(() => {
    if (!user) return
    getUserProgress().then(setProgress).catch(() => {})
    getUserAchievements().then((items) => {
      const next = items.find((item) => !item.unlocked)
      setNextAchievement(next || null)
    }).catch(() => {})
  }, [user])

  const data = useMemo<ResultState>(() => {
    if (remoteData) {
      return {
        setup: { stage: remoteData.stage, perLevelCount: 0, timeLimitSec: null, adaptive: true },
        total: remoteData.total,
        completed: remoteData.completed,
        correct: remoteData.correct,
        byLevel: remoteData.by_level,
        endedBy: remoteData.ended_by,
        cefrLevel: remoteData.cefr_level,
        cefrDesc: remoteData.cefr_desc,
      }
    }
    if (state && !state.sessionId) return state
    return {
      setup: { stage: '小学', perLevelCount: 4, timeLimitSec: 15 * 60, adaptive: true },
      total: 24,
      completed: 24,
      correct: 18,
      byLevel: [
        { level: '高频核心词', total: 8, correct: 7 },
        { level: '中频进阶词', total: 8, correct: 6 },
        { level: '低频生僻词', total: 8, correct: 5 },
        { level: '名词掌握度', total: 8, correct: 5 },
        { level: '动词掌握度', total: 8, correct: 5 },
        { level: '形/副词掌握度', total: 8, correct: 5 },
      ],
      endedBy: 'quota',
      cefrLevel: 'B1 (中级)',
      cefrDesc: '表现不错！大部分基础词汇已经掌握，能应对日常交流，但生僻词还需巩固。'
    }
  }, [state, remoteData])

  const radarRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  const accuracy = data.completed > 0 ? data.correct / data.completed : 0
  const levelScores = data.byLevel.map((x) => ({
    name: x.level,
    value: x.total > 0 ? Math.round((x.correct / x.total) * 100) : Math.round(accuracy * 100),
  }))

  const analysisText = data.cefrDesc || '系统未能收集到足够的答题数据。'

  useEffect(() => {
    if (!state || remoteData) return
    addRecord({
      stage: (data.setup?.stage || '小学') as '小学' | '初中' | '高中',
      correctRate: accuracy,
      total: data.total,
      endedBy: data.endedBy as 'quota' | 'time' | 'converge',
    })
  }, [accuracy, addRecord, data.endedBy, data.setup?.stage, data.total, state, remoteData])

  useEffect(() => {
    const el = radarRef.current
    if (!el) return
    
    // Add simple entrance animation to radar container
    gsap.fromTo(el,
      { opacity: 0, scale: 0.9, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.2)', delay: 0.2 }
    )

    const chart = echarts.init(el)
    const indicator = levelScores.map((x) => ({ name: x.name, max: 100 }))
    chart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator,
        splitNumber: 4,
        axisName: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
        splitArea: {
          areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] },
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: levelScores.map((x) => x.value),
              areaStyle: { color: 'rgba(167,139,250,0.22)' },
              lineStyle: { color: 'rgba(167,139,250,0.85)', width: 2 },
              itemStyle: { color: 'rgba(236,72,153,0.9)' },
            },
          ],
        },
      ],
    })
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [levelScores])

  const numberRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (remoteData?.vocab_score !== undefined && numberRef.current) {
      const obj = { val: 0 }
      gsap.to(obj, {
        val: remoteData.vocab_score,
        duration: 2.0,
        ease: "power2.out",
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.innerHTML = Math.round(obj.val).toString()
          }
        }
      })
    }
  }, [remoteData])

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    
    // Add simple entrance animation to bar container
    gsap.fromTo(el,
      { opacity: 0, x: 20 },
      { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out', delay: 0.3 }
    )

    const chart = echarts.init(el)
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 36, right: 18, top: 24, bottom: 28 },
      xAxis: {
        type: 'category',
        data: data.byLevel.map((x) => x.level),
        axisLabel: { color: 'rgba(255,255,255,0.65)' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.14)' } },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: 'rgba(255,255,255,0.55)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          type: 'bar',
          data: levelScores.map((x) => x.value),
          barWidth: 22,
          itemStyle: {
            borderRadius: [10, 10, 10, 10],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(124,58,237,0.95)' },
              { offset: 1, color: 'rgba(236,72,153,0.65)' },
            ]),
          },
        },
      ],
      tooltip: { trigger: 'axis' },
    })
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [data.byLevel, levelScores])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-white/55">测评报告</div>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {data.setup?.stage} · {Math.round(accuracy * 100)}% 正确率
              </h2>
              <div className="mt-2 text-sm text-white/60">
                完成 {data.completed}/{data.total} · 结束条件：{endedByText(data.endedBy)}
              </div>
            </div>
            {remoteData?.vocab_score !== undefined && (
              <div className="ml-4 flex gap-3">
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 px-6 py-4 text-center shadow-glow relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/0 via-brand-400/5 to-white/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="text-xs font-semibold text-brand-300 relative z-10">预估词汇量</div>
                  <div ref={numberRef} className="mt-1 text-3xl font-bold text-white tracking-tight relative z-10">
                    0
                  </div>
                </div>
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-6 py-4 text-center shadow-glow relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 via-purple-400/5 to-white/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="text-xs font-semibold text-purple-300 relative z-10">CEFR 等级</div>
                  <div className="mt-2 text-xl font-bold text-white tracking-tight relative z-10">
                    {data.cefrLevel}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/setup"
              className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              再测一次
            </Link>
            <Link
              to="/"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition hover:bg-white/10"
            >
              返回首页
            </Link>
          </div>
        </div>

        <div className="mt-8 mb-6 rounded-[2rem] border border-brand-500/30 bg-brand-500/10 p-6 shadow-glow backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-300">系统评估结论</h3>
              <p className="mt-1 text-sm text-white/80">{analysisText}</p>
            </div>
          </div>
        </div>

        {progress?.latest_achievements?.length ? (
          <div className="mb-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-200">最近解锁成就</div>
                <div className="mt-1 text-xs text-white/70">
                  当前连续学习 {progress.streak_days} 天，累计点亮 {progress.achievement_count} 枚成就。
                </div>
              </div>
              <Link to="/achievements" className="text-xs text-emerald-100/80 hover:text-white">
                查看全部成就
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {progress.latest_achievements.slice(0, 4).map((item) => (
                <div key={`${item.code}-${item.unlocked_at}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/85">
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {nextAchievement ? (
          <div className="mb-6 rounded-[2rem] border border-fuchsia-400/20 bg-fuchsia-400/10 p-6 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-fuchsia-100">下一目标推荐</div>
                <div className="mt-2 text-lg font-semibold text-white">{nextAchievement.title}</div>
                <div className="mt-1 text-sm text-white/70">{nextAchievement.description}</div>
              </div>
              <Link to="/achievements" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10">
                去成就馆查看
              </Link>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
                <span>当前进度</span>
                <span>{nextAchievement.progress_label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400"
                  style={{ width: `${Math.max(4, Math.round((nextAchievement.progress_current / nextAchievement.progress_target) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
            <div className="text-sm font-semibold text-white/85">能力雷达</div>
            <div className="mt-4 h-[320px]" ref={radarRef} />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
            <div className="text-sm font-semibold text-white/85">分级正确率</div>
            <div className="mt-4 h-[320px]" ref={barRef} />
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/85">错题与复测</div>
              <div className="mt-1 text-xs text-white/55">
                P0 先做报告与本地记录；后续接入词库后会落到错词表与复测计划
              </div>
            </div>
            <div className="text-xs text-white/55">
              自适应：{data.setup?.adaptive ? '开启' : '关闭'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {data.byLevel.map((x) => (
              <div
                key={x.level}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div className="text-sm font-semibold text-white/80">{x.level}</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {Math.round((x.correct / x.total) * 100)}%
                </div>
                <div className="mt-1 text-xs text-white/55">
                  {x.correct} / {x.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function endedByText(v: ResultState['endedBy']) {
  if (v === 'time') return '倒计时结束'
  if (v === 'converge') return '评估收敛'
  return '达到最大题量'
}
