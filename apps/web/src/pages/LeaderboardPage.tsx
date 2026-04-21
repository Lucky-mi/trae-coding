import { useEffect, useState } from 'react'
import { getLeaderboard } from '../api/client'
import type { LeaderboardEntry } from '../api/client'
import AppShell from '../components/AppShell'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('全部')

  const stages = ['全部', '小学', '初中', '高中']

  useEffect(() => {
    setLoading(true)
    const filter = activeTab === '全部' ? undefined : activeTab
    getLeaderboard(filter)
      .then((data) => {
        setEntries(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [activeTab])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            全服词汇量天梯榜
          </h1>
          <p className="mt-3 text-white/60">
            根据每位用户历史最高正确率预估出的词汇量，看看谁才是真正的词霸
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setActiveTab(stage)}
              className={`rounded-full px-6 py-2 text-sm font-medium transition ${
                activeTab === stage
                  ? 'bg-brand-500 text-white shadow-glow'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-panel-900 shadow-glow backdrop-blur overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-white/50">正在加载排行数据...</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-white/50">
              暂时还没有排行数据，去测一局霸榜吧！
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {entries.map((entry, idx) => (
                <div
                  key={entry.username}
                  className="flex items-center justify-between p-6 transition hover:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                        idx === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : idx === 1
                          ? 'bg-slate-300/20 text-slate-300'
                          : idx === 2
                          ? 'bg-orange-700/20 text-orange-400'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white/90">
                        {entry.username}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        最佳纪录来自：{entry.stage}测评
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-brand-300">
                      {entry.vocab_score}
                    </div>
                    <div className="text-xs text-white/50">预估词汇量</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
