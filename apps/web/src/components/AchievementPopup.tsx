import { useEffect } from 'react'
import { playAchievementFeedback } from '../utils/feedback'

type AchievementPopupProps = {
  exp?: number
  achievements: string[]
}

export default function AchievementPopup({ exp = 0, achievements }: AchievementPopupProps) {
  if (exp <= 0 && achievements.length === 0) return null

  useEffect(() => {
    playAchievementFeedback()
  }, [])

  return (
    <div className="pointer-events-none fixed right-6 top-24 z-50 w-[280px] rounded-[1.5rem] border border-brand-400/20 bg-panel-900/90 p-4 text-white shadow-[0_0_30px_rgba(168,85,247,0.18)] backdrop-blur-xl">
      <div className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-br from-brand-500/10 via-transparent to-fuchsia-500/10" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/15 text-2xl">
            ✨
          </div>
          <div>
            <div className="text-sm font-semibold text-white">成长反馈已到账</div>
            <div className="text-xs text-white/55">你的小植物正在变得更强壮</div>
          </div>
        </div>
        {exp > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            +{exp} Exp
          </div>
        ) : null}
        {achievements.length > 0 ? (
          <div className="mt-4 space-y-2">
            {achievements.map((name) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
                解锁成就：{name}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
