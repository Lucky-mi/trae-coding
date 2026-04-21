import * as echarts from 'echarts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useSession } from '../store/useSession'
import { getResult } from '../api/client'
import type { ResultOut } from '../api/client'

type ResultState = {
  sessionId?: string
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
}

export default function ResultPage() {
  const location = useLocation()
  const state = location.state as ResultState | null
  const addRecord = useSession((s) => s.addRecord)

  const [remoteData, setRemoteData] = useState<ResultOut | null>(null)

  useEffect(() => {
    if (state?.sessionId) {
      getResult(state.sessionId).then((res) => {
        setRemoteData(res)
      }).catch(err => {
        console.error(err)
      })
    }
  }, [state?.sessionId])

  const data = useMemo<ResultState>(() => {
    if (remoteData) {
      return {
        setup: { stage: remoteData.stage as any, perLevelCount: 0, timeLimitSec: null, adaptive: true },
        total: remoteData.total,
        completed: remoteData.completed,
        correct: remoteData.correct,
        byLevel: remoteData.by_level,
        endedBy: remoteData.ended_by as any,
      }
    }
    if (state && !state.sessionId) return state
    return {
      setup: { stage: '小学', perLevelCount: 4, timeLimitSec: 15 * 60, adaptive: true },
      total: 24,
      completed: 24,
      correct: 18,
      byLevel: [
        { level: '小学 1级', total: 8, correct: 7 },
        { level: '小学 2级', total: 8, correct: 6 },
        { level: '小学 3级', total: 8, correct: 5 },
      ],
      endedBy: 'quota',
    }
  }, [state, remoteData])

  const radarRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  const accuracy = data.completed > 0 ? data.correct / data.completed : 0
  const levelScores = data.byLevel.map((x) => ({
    name: x.level,
    value: x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0,
  }))

  let analysisText = '系统未能收集到足够的答题数据。'
  if (data.completed > 0) {
    if (accuracy >= 0.9) analysisText = '你的词汇量非常扎实，在这个阶段已经游刃有余，建议挑战更高难度的词库！'
    else if (accuracy >= 0.7) analysisText = '表现不错！大部分基础词汇已经掌握，但部分生僻词还需巩固。'
    else if (accuracy >= 0.4) analysisText = '处于正在积累的阶段，词汇量还有很大提升空间，建议多加复习。'
    else analysisText = '当前阶段对你来说可能有些困难，建议先从更基础的词库开始背记。'
  }

  useEffect(() => {
    if (!state || remoteData) return
    addRecord({
      stage: data.setup?.stage as any,
      correctRate: accuracy,
      total: data.total,
      endedBy: data.endedBy as any,
    })
  }, [accuracy, addRecord, data.endedBy, data.setup?.stage, data.total, state, remoteData])

  useEffect(() => {
    const el = radarRef.current
    if (!el) return
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

  useEffect(() => {
    const el = barRef.current
    if (!el) return
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
              <div className="ml-4 rounded-2xl border border-brand-500/20 bg-brand-500/10 px-6 py-4 text-center shadow-glow">
                <div className="text-xs font-semibold text-brand-300">预估词汇量</div>
                <div className="mt-1 text-3xl font-bold text-white tracking-tight">
                  {remoteData.vocab_score}
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
