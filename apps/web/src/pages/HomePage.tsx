import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ExpPlant, { getPlantRarityInfo, getPlantRouteInfo } from '../components/ExpPlant'
import { useAuth } from '../store/useAuth'
import { getTodayReview, getUserAchievements, getUserProgress } from '../api/client'
import { useEffect, useState } from 'react'
import type { UserAchievement, UserProgressSummary } from '../api/client'
import { PLANT_MILESTONE_EXP, useSession } from '../store/useSession'
import { getPlantCycleExp } from '../store/useSession'
import type { GardenPlant, PlantRoute } from '../store/useSession'

function getRarityMeta(rarity: 'common' | 'rare' | 'epic') {
  if (rarity === 'epic') return 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100'
  if (rarity === 'rare') return 'border-sky-400/30 bg-sky-400/10 text-sky-100'
  return 'border-white/10 bg-white/5 text-white/70'
}

export default function HomePage() {
  const { user } = useAuth()
  const { plantRoute, setPlantRoute, gardenPlants, activePlant, syncActivePlantCycle } = useSession()
  const [progress, setProgress] = useState<UserProgressSummary | null>(null)
  const [todayReviewCount, setTodayReviewCount] = useState(0)
  const [nextAchievement, setNextAchievement] = useState<UserAchievement | null>(null)
  const routeInfo = getPlantRouteInfo(plantRoute)
  const rarityInfo = getPlantRarityInfo(activePlant.rarity)
  const currentPlantExp = getPlantCycleExp(user?.exp || 0)

  useEffect(() => {
    if (!user) return
    syncActivePlantCycle(user.exp || 0)
    getUserProgress().then((data) => {
      setProgress(data)
    }).catch(() => {})
    getTodayReview().then((items) => setTodayReviewCount(items.length)).catch(() => {})
    getUserAchievements().then((items) => {
      const next = items.find((item) => !item.unlocked)
      setNextAchievement(next || null)
    }).catch(() => {})
  }, [syncActivePlantCycle, user])

  const recentCalendar = Array.from({ length: 14 }).map((_, index) => {
    const dayKey = Math.floor(Date.now() / 86400000) - (13 - index)
    const activity = progress?.recent_activity_days?.find((item) => item.day_key === dayKey)
    return { dayKey, active: !!activity, source: activity?.source || null }
  })
  const weeklyBars = Array.from({ length: 7 }).map((_, index) => {
    const dayKey = Math.floor(Date.now() / 86400000) - (6 - index)
    const active = progress?.recent_activity_days?.some((item) => item.day_key === dayKey)
    return { dayKey, value: active ? 100 : 20 }
  })
  
  return (
    <AppShell>
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel-900 px-4 py-2 text-xs text-white/75 shadow-glow backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            <span>匿名测评 + 云端同步（可选）</span>
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white md:text-6xl">
            30 分钟给出你的词汇画像
          </h1>
          <p className="text-pretty text-base leading-7 text-white/70 md:text-lg">
            分学段分级别精确抽题，带倒计时与进度条。结束后生成图表报告、错题本与复测建议。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/setup"
              className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              开始测评
            </Link>
            {!user ? (
              <Link
                to="/auth"
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                登录后同步记录
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 text-xs text-white/60">
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">题目分布</div>
              <div className="pt-1">按学段/级别配额</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">干扰项</div>
              <div className="pt-1">词形/词性相近</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">错题复测</div>
              <div className="pt-1">间隔重复策略</div>
            </div>
          </div>
        </div>

        <div className="relative">
          {user ? (
            <div className="relative h-full flex flex-col justify-center animate-[pop_0.5s_ease-out_forwards]">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-brand-500/20 to-transparent blur-3xl" />
              <div className="grid gap-4">
                <ExpPlant
                  exp={currentPlantExp}
                  route={plantRoute}
                  rarity={activePlant.rarity}
                  form={activePlant.form}
                  accent={activePlant.accent}
                  seed={activePlant.seed}
                  variantName={activePlant.variantName}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className={`rounded-[1.5rem] border p-4 backdrop-blur ${routeInfo.pillClass}`}>
                    <div className="text-[11px] opacity-75">当前分化</div>
                    <div className="mt-2 text-lg font-bold">{routeInfo.label}</div>
                    <div className="mt-1 text-xs opacity-80">{routeInfo.description}</div>
                  </div>
                  <div className={`rounded-[1.5rem] border p-4 backdrop-blur ${rarityInfo.pillClass}`}>
                    <div className="text-[11px] opacity-75">当前稀有度</div>
                    <div className="mt-2 text-lg font-bold">{rarityInfo.label}</div>
                    <div className="mt-1 text-xs opacity-80">当前变体：{activePlant.variantName}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="text-[11px] text-white/50">当前培育进度</div>
                    <div className="mt-2 text-lg font-bold text-white">第 {activePlant.cycle} 株</div>
                    <div className="mt-1 text-xs text-white/60">成熟后会自动入园，然后随机生成下一株。</div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-orange-400/15 bg-orange-400/10 p-5 backdrop-blur">
                    <div className="text-xs text-orange-200/70">连续打卡</div>
                    <div className="mt-2 text-3xl font-bold text-white">{progress?.streak_days ?? user.streak_days ?? 0}<span className="ml-1 text-sm font-medium text-white/55">天</span></div>
                    <div className="mt-2 text-xs text-white/55">每天回来做一轮测评或复习，植物会长得更快。</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-brand-400/15 bg-brand-400/10 p-5 backdrop-blur">
                    <div className="text-xs text-brand-100/70">已解锁成就</div>
                    <div className="mt-2 text-3xl font-bold text-white">{progress?.achievement_count ?? user.achievement_count ?? 0}<span className="ml-1 text-sm font-medium text-white/55">枚</span></div>
                    <div className="mt-2 text-xs text-white/55">测评、打卡和成长行为都会逐步点亮你的成就墙。</div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">成长路线</div>
                      <div className="mt-2 text-base font-semibold text-white">选择你喜欢的植物分化风格</div>
                      <div className="mt-1 text-xs text-white/55">{routeInfo.description}</div>
                    </div>
                    <div className="flex gap-2">
                      {[
                        ['tree', '树系', '枝干树冠'],
                        ['flower', '花系', '花瓣绽放'],
                        ['star', '星系', '星芒幻光'],
                      ].map(([value, label, subLabel]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPlantRoute(value as PlantRoute)}
                          className={`rounded-2xl border px-4 py-3 text-left text-xs transition ${
                            plantRoute === value
                              ? 'border-transparent bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-glow'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-semibold">{label}</div>
                          <div className="mt-1 text-[10px] opacity-80">{subLabel}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-medium ${routeInfo.pillClass}`}>
                    当前路线：{routeInfo.label}。主植物、进化演出和成熟入园都会沿用这条路线。
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/45">今日任务</div>
                        <div className="mt-2 text-lg font-semibold text-white">继续培育你的知识植物</div>
                      </div>
                      <Link to="/review" className="rounded-full bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10">
                        去完成
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs text-white/45">今日复习</div>
                        <div className="mt-1 text-sm text-white/80">待完成 {todayReviewCount} 个词条，复习可以稳住 streak 并获得额外 Exp。</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs text-white/45">成长目标</div>
                        <div className="mt-1 text-sm text-white/80">
                          {nextAchievement
                            ? `距离「${nextAchievement.title}」还差 ${nextAchievement.progress_target - nextAchievement.progress_current > 0 ? nextAchievement.progress_target - nextAchievement.progress_current : 0} 点进度。`
                            : '你已经点亮全部基础成就，继续冲击更高经验和更长连击。'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">连续打卡日历</div>
                      <Link to="/achievements" className="text-xs text-brand-300 hover:text-brand-200">查看成就馆</Link>
                    </div>
                    <div className="mt-4">
                      <div className="mb-3 text-[11px] text-white/40">本周成长曲线</div>
                      <div className="flex h-16 items-end gap-2">
                        {weeklyBars.map((item) => (
                          <div key={item.dayKey} className="flex flex-1 flex-col items-center gap-2">
                            <div className="w-full rounded-full bg-white/5">
                              <div
                                className="w-full rounded-full bg-gradient-to-t from-brand-500 to-fuchsia-400 transition-all duration-700"
                                style={{ height: `${item.value}%`, minHeight: '10px' }}
                              />
                            </div>
                            <span className="text-[10px] text-white/35">{new Date(item.dayKey * 86400000).getDate()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-7 gap-2">
                      {recentCalendar.map((item) => (
                        <div key={item.dayKey} className="flex flex-col items-center gap-2">
                          <div
                            title={`${new Date(item.dayKey * 86400000).toLocaleDateString()} · ${item.active ? (item.source === 'review' ? '完成复习' : '完成测评') : '未打卡'}`}
                            className={`h-9 w-9 rounded-2xl border transition ${
                              item.active
                                ? item.source === 'review'
                                  ? 'border-emerald-400/30 bg-emerald-400/20 shadow-[0_0_18px_rgba(52,211,153,0.18)]'
                                  : 'border-brand-400/30 bg-brand-400/20 shadow-[0_0_18px_rgba(167,139,250,0.18)]'
                                : 'border-white/10 bg-white/5'
                            }`}
                          />
                          <span className="text-[10px] text-white/35">{new Date(item.dayKey * 86400000).getDate()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">私人花园</div>
                      <div className="mt-2 text-lg font-semibold text-white">成熟植物会自动入园收藏</div>
                      <div className="mt-1 text-sm text-white/60">
                        当前已收藏 {gardenPlants.length} 株。每跨过新的成熟阈值，都会生成一株带随机昵称和稀有度的变体。
                      </div>
                    </div>
                    <Link to="/garden" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/75 hover:bg-white/10">
                      进入花园馆
                    </Link>
                  </div>

                  {gardenPlants.length > 0 ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {gardenPlants.slice(0, 6).map((plant: GardenPlant) => (
                        <div key={plant.id} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{plant.nickname}</div>
                              <div className="mt-1 text-[11px] text-white/45">
                                {plant.route === 'tree' ? '树系' : plant.route === 'flower' ? '花系' : '星系'} · {new Date(plant.collectedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getRarityMeta(plant.rarity)}`}>
                              {plant.rarity === 'epic' ? '史诗' : plant.rarity === 'rare' ? '稀有' : '普通'}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-center rounded-[1.25rem] border border-white/10 bg-black/10 py-3">
                            <div className="scale-90">
                              <ExpPlant
                                exp={PLANT_MILESTONE_EXP}
                                route={plant.route}
                                rarity={plant.rarity}
                                form={plant.form}
                                accent={plant.accent}
                                seed={plant.seed}
                                variantName={plant.variantName}
                                showMeta={false}
                              />
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                            {plant.rarity === 'epic' ? '史诗' : plant.rarity === 'rare' ? '稀有' : '普通'} · {plant.variantName} · 第 {plant.cycle} 株成熟入园。
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-5 py-6 text-sm text-white/60">
                      你的花园还没有成熟植物。先把主植物养到成熟形态，第一株就会自动种进这里。
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/85">
                    测评进行中
                  </div>
                  <div className="text-xs text-white/55">00:42</div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400" />
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-white/55">题目 12 / 24</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      “abandon” 的中文意思是？
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {['放弃', '收集', '隐藏', '选择'].map((t) => (
                      <div
                        key={t}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80 transition hover:bg-white/10"
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-white/55">
                  <span>自适应难度：开启</span>
                  <span className="animate-floaty">准备就绪</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </AppShell>
  )
}
