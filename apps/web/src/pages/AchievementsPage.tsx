import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { getUserAchievements } from '../api/client'
import type { UserAchievement } from '../api/client'

function iconEmoji(icon: string) {
  switch (icon) {
    case 'seedling': return '🌱'
    case 'sparkles': return '✨'
    case 'flame': return '🔥'
    case 'trophy': return '🏆'
    case 'book-open': return '📘'
    case 'stars': return '🌟'
    case 'crown': return '👑'
    case 'target': return '🎯'
    case 'bolt': return '⚡'
    case 'gem': return '💎'
    case 'sun': return '☀️'
    default: return '🏅'
  }
}

function rarityStyle(rarity: string) {
  switch (rarity) {
    case 'legendary':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-100'
    case 'epic':
      return 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100'
    case 'rare':
      return 'border-sky-400/25 bg-sky-400/10 text-sky-100'
    default:
      return 'border-white/10 bg-white/5 text-white/70'
  }
}

function categoryLabel(category: string) {
  switch (category) {
    case 'assessment': return '测评'
    case 'review': return '复习'
    case 'streak': return '打卡'
    default: return '成长'
  }
}

export default function AchievementsPage() {
  const [items, setItems] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

  useEffect(() => {
    getUserAchievements()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((item) => filter === 'unlocked' ? item.unlocked : !item.unlocked)
  }, [items, filter])

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/55">成长成就馆</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">成就与徽章</h1>
              <p className="mt-2 text-sm text-white/65">这里会记录你的测评、复习、打卡和成长里程碑。</p>
            </div>
            <div className="flex gap-2">
              {[
                ['all', '全部'],
                ['unlocked', '已解锁'],
                ['locked', '进行中'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key as 'all' | 'unlocked' | 'locked')}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    filter === key
                      ? 'bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-glow'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-white/55">正在加载成就...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const progress = item.progress_target > 0
                ? Math.min(100, Math.round((item.progress_current / item.progress_target) * 100))
                : 100
              return (
                <div
                  key={item.code}
                  className={`rounded-[1.75rem] border p-5 backdrop-blur transition ${
                    item.unlocked
                      ? 'border-brand-400/20 bg-brand-400/10 shadow-glow'
                      : 'border-white/10 bg-panel-900/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
                          item.unlocked ? 'bg-white/10' : 'bg-white/5 grayscale'
                        }`}>
                          {iconEmoji(item.icon)}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-white">{item.title}</div>
                          <div className="text-xs text-white/50">
                            {item.unlocked && item.unlocked_at
                              ? `解锁于 ${new Date(item.unlocked_at).toLocaleDateString()}`
                              : '尚未解锁'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] ${rarityStyle(item.rarity)}`}>
                          {item.rarity}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
                          {categoryLabel(item.category)}
                        </span>
                      </div>
                    </div>
                    {item.unlocked ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">已解锁</span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">进行中</span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/70">{item.description}</p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
                      <span>进度</span>
                      <span>{item.progress_label}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400 transition-all duration-700"
                        style={{ width: `${Math.max(item.unlocked ? 100 : 4, progress)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
