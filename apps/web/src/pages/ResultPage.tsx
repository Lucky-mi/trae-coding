import * as echarts from 'echarts'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useSession } from '../store/useSession'

type ResultState = {
  setup: {
    stage: '小学' | '初中' | '高中'
    perLevelCount: number
    timeLimitSec: number | null
    adaptive: boolean
  }
  total: number
  completed: number
  correct: number
  byLevel: Array<{ level: string; total: number; correct: number }>
  endedBy: 'quota' | 'time' | 'converge'
}

export default function ResultPage() {
  const location = useLocation()
  const state = location.state as ResultState | null
  const addRecord = useSession((s) => s.addRecord)

  const data = useMemo<ResultState>(() => {
    if (state) return state
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
  }, [state])

  const radarRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  const accuracy = data.completed > 0 ? data.correct / data.completed : 0
  const levelScores = data.byLevel.map((x) => ({
    name: x.level,
    value: x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0,
  }))

  useEffect(() => {
    if (!state) return
    addRecord({
      stage: data.setup.stage,
      correctRate: accuracy,
      total: data.total,
      endedBy: data.endedBy,
    })
  }, [accuracy, addRecord, data.endedBy, data.setup.stage, data.total, state])

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
          <div>
            <div className="text-xs text-white/55">测评报告</div>
            <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
              {data.setup.stage} · {Math.round(accuracy * 100)}% 正确率
            </h2>
            <div className="mt-2 text-sm text-white/60">
              完成 {data.completed}/{data.total} · 结束条件：{endedByText(data.endedBy)}
            </div>
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

        <div className="mt-8 grid gap-6 md:grid-cols-2">
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
              自适应：{data.setup.adaptive ? '开启' : '关闭'}
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
