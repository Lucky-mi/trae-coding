import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ExpPlant, { getPlantRarityInfo, getPlantRouteInfo } from '../components/ExpPlant'
import { useAuth } from '../store/useAuth'
import { getPlantCycleExp, PLANT_MILESTONE_EXP, useSession } from '../store/useSession'
import type { PlantRarity, PlantRoute, SessionState } from '../store/useSession'

type RouteFilter = 'all' | PlantRoute
type RarityFilter = 'all' | PlantRarity
type SortMode = 'newest' | 'rarity' | 'cycle'

function routeLabel(route: PlantRoute) {
  return getPlantRouteInfo(route).label
}

function rarityRank(rarity: PlantRarity) {
  if (rarity === 'epic') return 3
  if (rarity === 'rare') return 2
  return 1
}

function formatCollectedAt(ts: number) {
  return new Date(ts).toLocaleString()
}

export default function GardenPage() {
  const { user } = useAuth()
  const { gardenPlants, activePlant } = useSession((s: SessionState) => ({
    gardenPlants: s.gardenPlants,
    activePlant: s.activePlant,
  }))
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all')
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(gardenPlants[0]?.id || null)

  const currentPlantExp = getPlantCycleExp(user?.exp || 0)
  const activeRouteInfo = getPlantRouteInfo(activePlant.route)
  const activeRarityInfo = getPlantRarityInfo(activePlant.rarity)

  const filteredPlants = useMemo(() => {
    const next = gardenPlants
      .filter((plant) => routeFilter === 'all' || plant.route === routeFilter)
      .filter((plant) => rarityFilter === 'all' || plant.rarity === rarityFilter)

    next.sort((a, b) => {
      if (sortMode === 'rarity') {
        return rarityRank(b.rarity) - rarityRank(a.rarity) || b.collectedAt - a.collectedAt
      }
      if (sortMode === 'cycle') {
        return b.cycle - a.cycle || b.collectedAt - a.collectedAt
      }
      return b.collectedAt - a.collectedAt
    })
    return next
  }, [gardenPlants, rarityFilter, routeFilter, sortMode])

  useEffect(() => {
    if (!filteredPlants.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredPlants.some((plant) => plant.id === selectedId)) {
      setSelectedId(filteredPlants[0].id)
    }
  }, [filteredPlants, selectedId])

  const selectedPlant = filteredPlants.find((plant) => plant.id === selectedId) || filteredPlants[0] || null

  const stats = useMemo(() => {
    const uniqueVariants = new Set(gardenPlants.map((plant) => `${plant.route}-${plant.variantName}`))
    const uniqueRareForms = new Set(
      gardenPlants
        .filter((plant) => plant.rarity !== 'common')
        .map((plant) => `${plant.route}-${plant.variantName}-${plant.rarity}`),
    )
    return {
      total: gardenPlants.length,
      epic: gardenPlants.filter((plant) => plant.rarity === 'epic').length,
      rarePlus: gardenPlants.filter((plant) => plant.rarity !== 'common').length,
      uniqueVariants: uniqueVariants.size,
      uniqueRareForms: uniqueRareForms.size,
    }
  }, [gardenPlants])

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-xs text-white/55">私人花园馆</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">植物图鉴与收藏</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                每一株成熟植物都会被永久收藏。路线由你决定，稀有度和外形会在每一轮成熟后随机生成。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] text-white/45">图鉴收集</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.uniqueVariants}<span className="ml-1 text-sm text-white/45">/ 9</span></div>
                <div className="mt-1 text-xs text-white/55">基础变体已点亮 {Math.round((stats.uniqueVariants / 9) * 100)}%</div>
              </div>
              <div className="rounded-[1.5rem] border border-fuchsia-400/15 bg-fuchsia-400/10 px-4 py-3">
                <div className="text-[11px] text-fuchsia-100/65">稀有收藏</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.rarePlus}</div>
                <div className="mt-1 text-xs text-white/55">其中史诗 {stats.epic} 株，稀有形态 {stats.uniqueRareForms} 种</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-white/45">当前培育中</div>
                <div className="mt-2 text-lg font-semibold text-white">第 {activePlant.cycle} 株 · {activePlant.variantName}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${activeRarityInfo.pillClass}`}>
                {activeRarityInfo.label}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="flex items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/10 p-3">
                <ExpPlant
                  exp={currentPlantExp}
                  route={activePlant.route}
                  rarity={activePlant.rarity}
                  form={activePlant.form}
                  accent={activePlant.accent}
                  seed={activePlant.seed}
                  variantName={activePlant.variantName}
                />
              </div>
              <div className="space-y-3">
                <div className={`rounded-2xl border px-4 py-3 text-sm ${activeRouteInfo.pillClass}`}>
                  当前路线：{activeRouteInfo.label}，后续仍会沿这个大分化方向成长。
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  本株成长值为 {currentPlantExp}，成熟后会自动入园，并生成下一株随机稀有度和外形的后继植物。
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to="/review" className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
                    去复习养成
                  </Link>
                  <Link to="/setup" className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10">
                    去测评冲刺
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
            <div className="text-xs text-white/45">收藏速览</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] text-white/45">已收藏总数</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
                <div className="text-[11px] text-emerald-100/70">路线覆盖</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {(['tree', 'flower', 'star'] as const)
                    .filter((route) => gardenPlants.some((plant) => plant.route === route))
                    .map((route) => routeLabel(route))
                    .join(' / ') || '尚未点亮'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                图鉴推荐：优先收集三条路线的 9 种基础变体，再去冲击 `稀有` 和 `史诗` 版本。
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-panel-900/70 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/45">筛选收藏</div>
              <div className="mt-2 text-lg font-semibold text-white">按路线、稀有度和成熟顺序查看</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', '全部路线'],
                ['tree', '树系'],
                ['flower', '花系'],
                ['star', '星系'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRouteFilter(value)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    routeFilter === value
                      ? 'bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-glow'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ['all', '全部稀有度'],
              ['common', '普通'],
              ['rare', '稀有'],
              ['epic', '史诗'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRarityFilter(value)}
                className={`rounded-full px-4 py-2 text-xs transition ${
                  rarityFilter === value
                    ? 'border border-white/0 bg-white/15 text-white'
                    : 'border border-white/10 bg-white/5 text-white/65 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
            {([
              ['newest', '按最新'],
              ['rarity', '按稀有'],
              ['cycle', '按株次'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortMode(value)}
                className={`rounded-full px-4 py-2 text-xs transition ${
                  sortMode === value
                    ? 'border border-brand-400/20 bg-brand-400/10 text-brand-100'
                    : 'border border-white/10 bg-white/5 text-white/65 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {filteredPlants.length === 0 ? (
          <section className="rounded-[1.75rem] border border-dashed border-white/10 bg-panel-900/60 px-6 py-10 text-center">
            <div className="text-lg font-semibold text-white">这组筛选下还没有植物</div>
            <div className="mt-2 text-sm text-white/60">继续复习或测评，先把新的成熟植物养出来。</div>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPlants.map((plant) => {
                const rarityInfo = getPlantRarityInfo(plant.rarity)
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() => setSelectedId(plant.id)}
                    className={`overflow-hidden rounded-[1.6rem] border p-4 text-left transition ${
                      selectedPlant?.id === plant.id
                        ? 'border-brand-400/30 bg-brand-400/10 shadow-glow'
                        : 'border-white/10 bg-panel-900/70 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{plant.nickname}</div>
                        <div className="mt-1 text-[11px] text-white/45">
                          {routeLabel(plant.route)} · {plant.variantName}
                        </div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${rarityInfo.pillClass}`}>
                        {rarityInfo.label}
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
                    <div className="mt-3 text-xs text-white/60">
                      第 {plant.cycle} 株 · 收藏于 {new Date(plant.collectedAt).toLocaleDateString()}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="xl:sticky xl:top-24 xl:self-start">
              {selectedPlant ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-panel-900/80 p-5 shadow-glow backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">植物详情</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{selectedPlant.nickname}</div>
                      <div className="mt-1 text-sm text-white/55">{routeLabel(selectedPlant.route)} · {selectedPlant.variantName}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getPlantRarityInfo(selectedPlant.rarity).pillClass}`}>
                      {getPlantRarityInfo(selectedPlant.rarity).label}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-center rounded-[1.5rem] border border-white/10 bg-black/10 py-4">
                    <ExpPlant
                      exp={PLANT_MILESTONE_EXP}
                      route={selectedPlant.route}
                      rarity={selectedPlant.rarity}
                      form={selectedPlant.form}
                      accent={selectedPlant.accent}
                      seed={selectedPlant.seed}
                      variantName={selectedPlant.variantName}
                    />
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-[11px] text-white/45">收藏记录</div>
                      <div className="mt-1 text-sm text-white/80">第 {selectedPlant.cycle} 株于 {formatCollectedAt(selectedPlant.collectedAt)} 成熟入园。</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-[11px] text-white/45">图鉴标签</div>
                      <div className="mt-1 text-sm text-white/80">
                        {routeLabel(selectedPlant.route)} / {getPlantRarityInfo(selectedPlant.rarity).label} / {selectedPlant.variantName}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      这株植物的外形由路线固定骨架和随机变体共同决定，所以同一路线下也会持续长出不一样的收藏品。
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
