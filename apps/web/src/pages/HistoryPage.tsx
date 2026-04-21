import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHistory } from '../api/client'
import type { HistorySession } from '../api/client'
import AppShell from '../components/AppShell'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)

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
