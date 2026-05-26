import { useEffect } from 'react'
import ExpPlant, { getPlantRarityInfo } from './ExpPlant'
import { PLANT_MILESTONE_EXP } from '../store/useSession'
import type { GardenPlant } from '../store/useSession'

type GardenCollectionPopupProps = {
  plants: GardenPlant[]
}

function getRarityMeta(rarity: GardenPlant['rarity']) {
  const info = getPlantRarityInfo(rarity)
  return {
    label: info.label,
    className: info.pillClass,
  }
}

export default function GardenCollectionPopup({ plants }: GardenCollectionPopupProps) {
  const newestPlant = plants[0]
  const rarityMeta = getRarityMeta(newestPlant.rarity)

  useEffect(() => {
    if ('vibrate' in navigator) navigator.vibrate([70, 30, 120])
  }, [])

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[65] w-[min(92vw,360px)] animate-[pop_0.35s_ease-out_forwards]">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-400/20 bg-panel-950/95 p-4 shadow-[0_0_40px_rgba(16,185,129,0.16)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.18),transparent_45%)]" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-emerald-200/65">GARDEN</div>
              <div className="mt-2 text-lg font-bold text-white">成熟植物已入园</div>
              <div className="mt-1 text-sm text-white/60">
                {plants.length > 1 ? `本次共收藏 ${plants.length} 株，最新一株如下。` : '这株成熟植物已经被种进你的私人花园。'}
              </div>
            </div>
            <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${rarityMeta.className}`}>
              {rarityMeta.label}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[96px_1fr] items-center gap-3">
            <div className="scale-90">
              <ExpPlant
                exp={PLANT_MILESTONE_EXP}
                route={newestPlant.route}
                rarity={newestPlant.rarity}
                form={newestPlant.form}
                accent={newestPlant.accent}
                seed={newestPlant.seed}
                variantName={newestPlant.variantName}
                showMeta={false}
              />
            </div>
            <div>
              <div className="text-base font-semibold text-white">{newestPlant.nickname}</div>
              <div className="mt-1 text-xs text-white/50">
                {newestPlant.route === 'tree' ? '树系' : newestPlant.route === 'flower' ? '花系' : '星系'} · {newestPlant.variantName} · 第 {newestPlant.cycle} 株
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                继续积累经验，后续每跨过新的成熟阈值都会再收藏一株随机稀有度和不同外形的变体。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
