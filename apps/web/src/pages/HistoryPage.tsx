import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { getHistory } from '../api/client'
import type { HistorySession } from '../api/client'
import AppShell from '../components/AppShell'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getHistory()
      .then((data: HistorySession[]) => {
        setSessions(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading || sessions.length === 0 || !chartRef.current) return

    // Group max score per day, or just plot chronologically
    // Since sessions is ordered by created_at DESC from API, reverse it for chronological order
    const chronological = [...sessions].reverse().filter(s => s.status === 'completed')
    
    if (chronological.length === 0) return

    const chart = echarts.init(chartRef.current)
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: chronological.map(s => {
          const d = new Date(s.created_at)
          return `${d.getMonth()+1}-${d.getDate()}`
        }),
        axisLabel: { color: 'rgba(255,255,255,0.65)' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.14)' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.55)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
      },
      series: [
        {
          name: '词汇量',
          type: 'line',
          data: chronological.map(s => s.vocab_score),
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: '#a78bfa' },
          lineStyle: { width: 3, color: '#a78bfa' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(167,139,250,0.5)' },
              { offset: 1, color: 'rgba(167,139,250,0.0)' }
            ])
          }
        }
      ]
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [sessions, loading])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">测评历史记录</h1>
          <Link
            to="/setup"
            className="rounded-full bg-brand-500/20 px-4 py-2 text-sm font-semibold text-brand-300 transition hover:bg-brand-500/30"
          >
            开始新测评
          </Link>
        </div>

        {!loading && sessions.filter(s => s.status === 'completed').length > 1 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-panel-800 p-6 shadow-xl backdrop-blur-md">
            <h2 className="mb-2 text-lg font-semibold text-white/80">词汇量成长轨迹</h2>
            <div ref={chartRef} className="h-64 w-full" />
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {loading ? (
            <div className="text-white/50">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
              暂无历史记录，去测一测吧！
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/result`, { state: { sessionId: s.id } })}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur transition hover:bg-white/5 hover:border-brand-500/50"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-brand-500/20 px-2 py-1 text-xs font-semibold text-brand-300">
                      {s.stage}
                    </span>
                    {s.status !== 'completed' && (
                      <span className="rounded bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-300">
                        未完成
                      </span>
                    )}
                    <span className="text-sm text-white/50">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white/90">
                    正确率: {s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0}%
                  </div>
                </div>
                <div className="text-right text-sm text-white/60">
                  共 {s.total} 题，答对 {s.correct} 题
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
