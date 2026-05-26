import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PLANT_MILESTONE_EXP, useSession } from '../store/useSession'
import type { PlantRarity, PlantRoute, SessionState } from '../store/useSession'

export function getPlantStageInfo(exp = 0) {
  if (exp < 10) return { name: '智慧种子', progress: (exp / 10) * 100, next: 10, color: 'text-stone-400', level: 1 }
  if (exp < 25) return { name: '初绽嫩芽', progress: ((exp - 10) / 15) * 100, next: 25, color: 'text-emerald-400', level: 2 }
  if (exp < 50) return { name: '茁壮小树', progress: ((exp - 25) / 25) * 100, next: 50, color: 'text-green-400', level: 3 }
  if (exp < PLANT_MILESTONE_EXP) return { name: '知识花海', progress: ((exp - 50) / (PLANT_MILESTONE_EXP - 50)) * 100, next: PLANT_MILESTONE_EXP, color: 'text-pink-400', level: 4 }
  return { name: '世界之树', progress: 100, next: exp, color: 'text-fuchsia-400', level: 5 }
}

export function getPlantRarityInfo(rarity: PlantRarity) {
  if (rarity === 'epic') {
    return {
      label: '史诗',
      pillClass: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100',
      glowClass: 'from-fuchsia-400/30 via-violet-400/20 to-transparent',
      sparkleClass: 'bg-fuchsia-200/85',
    }
  }
  if (rarity === 'rare') {
    return {
      label: '稀有',
      pillClass: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
      glowClass: 'from-sky-400/25 via-cyan-300/18 to-transparent',
      sparkleClass: 'bg-sky-100/85',
    }
  }
  return {
    label: '普通',
    pillClass: 'border-white/10 bg-white/5 text-white/70',
    glowClass: 'from-white/10 via-white/5 to-transparent',
    sparkleClass: 'bg-white/70',
  }
}

export function getPlantRouteInfo(route: PlantRoute) {
  if (route === 'flower') {
    return {
      label: '花系',
      description: '偏柔和绽放，花瓣与花冠会更明显',
      pillClass: 'border-pink-400/25 bg-pink-400/10 text-pink-100',
      auraClass: 'from-pink-500/20 via-rose-400/12 to-transparent',
      progressClass: 'from-pink-400 to-rose-400',
    }
  }
  if (route === 'star') {
    return {
      label: '星系',
      description: '偏梦幻能量，星芒与紫辉会更强烈',
      pillClass: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
      auraClass: 'from-violet-500/22 via-fuchsia-400/12 to-transparent',
      progressClass: 'from-violet-400 to-fuchsia-400',
    }
  }
  return {
    label: '树系',
    description: '偏枝干与树冠，整体更像成长中的知识树',
    pillClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    auraClass: 'from-emerald-500/20 via-lime-400/12 to-transparent',
    progressClass: 'from-emerald-400 to-lime-400',
  }
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return [cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius]
}

function buildStarPoints(cx: number, cy: number, outerRadius: number, innerRadius: number, points = 5, rotateDeg = -90) {
  const result: string[] = []
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const [x, y] = polarPoint(cx, cy, radius, rotateDeg + (360 / (points * 2)) * i)
    result.push(`${x},${y}`)
  }
  return result.join(' ')
}

function getAccentPalette(route: PlantRoute, accent: number, rarity: PlantRarity) {
  const palettes = {
    tree: [
      { primary: '#22c55e', secondary: '#4ade80', tertiary: '#bbf7d0', stem: '#166534', aura: '#22c55e' },
      { primary: '#84cc16', secondary: '#4ade80', tertiary: '#dcfce7', stem: '#3f6212', aura: '#84cc16' },
      { primary: '#2dd4bf', secondary: '#6ee7b7', tertiary: '#ccfbf1', stem: '#0f766e', aura: '#2dd4bf' },
    ],
    flower: [
      { primary: '#f472b6', secondary: '#fb7185', tertiary: '#fce7f3', stem: '#16a34a', aura: '#f472b6' },
      { primary: '#fb7185', secondary: '#fdba74', tertiary: '#ffe4e6', stem: '#15803d', aura: '#fb7185' },
      { primary: '#c084fc', secondary: '#f9a8d4', tertiary: '#f3e8ff', stem: '#16a34a', aura: '#c084fc' },
    ],
    star: [
      { primary: '#c084fc', secondary: '#e879f9', tertiary: '#f5d0fe', stem: '#7e22ce', aura: '#d946ef' },
      { primary: '#818cf8', secondary: '#a5b4fc', tertiary: '#e0e7ff', stem: '#4338ca', aura: '#818cf8' },
      { primary: '#22d3ee', secondary: '#67e8f9', tertiary: '#cffafe', stem: '#0e7490', aura: '#22d3ee' },
    ],
  } as const
  const palette = palettes[route][accent % palettes[route].length]
  if (rarity === 'epic') {
    return { ...palette, tertiary: '#ffffff' }
  }
  return palette
}

type ExpPlantProps = {
  exp: number
  route?: PlantRoute
  rarity?: PlantRarity
  form?: number
  accent?: number
  seed?: number
  variantName?: string
  showMeta?: boolean
}

export default function ExpPlant({
  exp = 0,
  route,
  rarity,
  form,
  accent,
  seed,
  variantName,
  showMeta = true,
}: ExpPlantProps) {

  const stageInfo = useMemo(() => getPlantStageInfo(exp), [exp])
  const currentRoute = useSession((s: SessionState) => s.plantRoute)
  const activePlant = useSession((s: SessionState) => s.activePlant)
  const plantRoute = route || activePlant.route || currentRoute
  const plantRarity = rarity || activePlant.rarity
  const plantForm = form ?? activePlant.form ?? 0
  const plantAccent = accent ?? activePlant.accent ?? 0
  const plantSeed = seed ?? activePlant.seed ?? 1
  const plantVariantName = variantName || activePlant.variantName
  const routeInfo = getPlantRouteInfo(plantRoute)
  const rarityInfo = getPlantRarityInfo(plantRarity)
  const palette = getAccentPalette(plantRoute, plantAccent, plantRarity)

  const shellRef = useRef<HTMLDivElement>(null)
  const plantRef = useRef<HTMLDivElement>(null)
  const prevLevelRef = useRef(stageInfo.level)
  const [levelUp, setLevelUp] = useState(false)

  useEffect(() => {
    if (!shellRef.current || !plantRef.current) return
    gsap.fromTo(
      shellRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
    )
  }, [])

  useEffect(() => {
    if (!plantRef.current) return
    gsap.fromTo(
      plantRef.current,
      { scale: 0.98, rotate: -2 },
      { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' },
    )

    if (stageInfo.level > prevLevelRef.current) {
      setLevelUp(true)
      gsap.fromTo(
        plantRef.current,
        { scale: 0.8, filter: 'brightness(1.5)' },
        { scale: 1.12, filter: 'brightness(1)', duration: 0.8, yoyo: true, repeat: 1, ease: 'back.out(1.7)' },
      )
      window.setTimeout(() => setLevelUp(false), 1800)
    }
    prevLevelRef.current = stageInfo.level
  }, [exp, stageInfo.level])

  const renderSVG = () => {
    const { level } = stageInfo
    const isTree = plantRoute === 'tree'
    const isFlower = plantRoute === 'flower'
    const isStar = plantRoute === 'star'
    const seedNudge = ((plantSeed % 9) - 4) * 0.6
    const formKey = plantForm % 3

    const renderRarityDecor = () => {
      if (plantRarity === 'common') return null
      return (
        <>
          {plantRarity === 'epic' ? <circle cx="50" cy="18" r="26" fill="none" stroke={palette.tertiary} strokeOpacity="0.55" strokeWidth="1.6" /> : null}
          <circle cx="22" cy="20" r="3" fill={palette.tertiary} fillOpacity={plantRarity === 'epic' ? 1 : 0.75} />
          <circle cx="80" cy="18" r="2.8" fill={palette.tertiary} fillOpacity={plantRarity === 'epic' ? 1 : 0.75} />
          <circle cx="74" cy="54" r="2.5" fill={palette.tertiary} fillOpacity={plantRarity === 'epic' ? 1 : 0.65} />
        </>
      )
    }

    if (level === 1) {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
          <circle cx="50" cy="80" r={formKey === 1 ? 12 : formKey === 2 ? 16 : 14} fill={isStar ? '#312e81' : isFlower ? '#7c2d5c' : '#57534e'} />
          <path d={`M 50 80 Q ${61 + seedNudge} 65 50 50 Q ${39 - seedNudge} 65 50 80`} fill={isStar ? palette.primary : isFlower ? palette.primary : palette.secondary} />
          {isStar || plantRarity !== 'common' ? <circle cx={69 + seedNudge} cy="28" r="3" fill={palette.tertiary} /> : null}
          {renderRarityDecor()}
        </svg>
      )
    }
    if (level === 2) {
      if (isFlower) {
        return (
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_16px_rgba(244,114,182,0.35)]">
            <path d="M 50 90 Q 50 62 50 40" stroke={palette.stem} strokeWidth="6" strokeLinecap="round" fill="none" />
            <ellipse cx="42" cy={formKey === 2 ? 30 : 34} rx={formKey === 1 ? 6 : 8} ry="12" fill={palette.secondary} />
            <ellipse cx="58" cy={formKey === 2 ? 30 : 34} rx={formKey === 1 ? 6 : 8} ry="12" fill={palette.primary} />
            {formKey !== 0 ? <ellipse cx="50" cy="24" rx="6" ry="10" fill={palette.tertiary} fillOpacity="0.92" /> : null}
            <circle cx="50" cy="34" r="5" fill="#fde68a" />
            <path d={`M 50 64 Q ${36 - seedNudge} 58 30 44 Q 42 47 50 58`} fill="#4ade80" />
            {renderRarityDecor()}
          </svg>
        )
      }
      if (isStar) {
        return (
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]">
            <path d="M 50 92 Q 50 62 50 38" stroke={palette.stem} strokeWidth="6" strokeLinecap="round" fill="none" />
            <polygon points={buildStarPoints(50, 32, formKey === 2 ? 20 : 18, formKey === 1 ? 9 : 7, formKey === 1 ? 6 : 5)} fill={palette.tertiary} />
            {formKey === 1 ? <circle cx="50" cy="32" r="14" fill="none" stroke={palette.secondary} strokeWidth="1.4" strokeOpacity="0.7" /> : null}
            {formKey === 2 ? <path d="M 63 38 Q 78 46 84 60" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.75" /> : null}
            <circle cx="34" cy="22" r="3" fill={palette.secondary} />
            <circle cx="68" cy="16" r="2.5" fill={palette.primary} />
            {renderRarityDecor()}
          </svg>
        )
      }
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
          <path d={`M 50 90 Q ${formKey === 1 ? 46 : 50} 62 ${50 + seedNudge * 0.2} 34`} stroke={palette.stem} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d={`M 50 64 Q ${35 - seedNudge} 55 28 40 Q 44 44 50 58`} fill={palette.secondary} />
          <path d={`M 50 54 Q ${64 + seedNudge} 44 72 30 Q 58 34 50 50`} fill={palette.primary} />
          {formKey !== 0 ? <circle cx="50" cy="30" r={formKey === 2 ? 7 : 5} fill={palette.tertiary} fillOpacity="0.9" /> : null}
          {renderRarityDecor()}
        </svg>
      )
    }
    if (level === 3) {
      if (isFlower) {
        return (
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_20px_rgba(244,114,182,0.45)]">
            <path d="M 50 95 Q 50 56 50 24" stroke={palette.stem} strokeWidth="7" strokeLinecap="round" fill="none" />
            <ellipse cx="50" cy={formKey === 2 ? 18 : 24} rx={formKey === 1 ? 10 : 12} ry={formKey === 2 ? 18 : 14} fill={palette.primary} />
            <ellipse cx="36" cy="30" rx={formKey === 1 ? 6 : 8} ry="12" fill={palette.secondary} />
            <ellipse cx="64" cy="30" rx={formKey === 1 ? 6 : 8} ry="12" fill={palette.secondary} />
            {formKey !== 0 ? <ellipse cx="50" cy="42" rx="8" ry="12" fill={palette.tertiary} fillOpacity="0.85" /> : null}
            <circle cx="50" cy="24" r="6" fill="#fde68a" />
            <path d="M 50 68 Q 28 58 18 36 Q 40 42 50 58" fill="#4ade80" />
            <path d="M 50 56 Q 72 46 82 26 Q 60 34 50 48" fill="#4ade80" />
            {renderRarityDecor()}
          </svg>
        )
      }
      if (isStar) {
        return (
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_22px_rgba(168,85,247,0.45)]">
            <path d="M 50 95 Q 50 58 50 24" stroke={palette.stem} strokeWidth="7" strokeLinecap="round" fill="none" />
            <polygon points={buildStarPoints(50, 26, formKey === 2 ? 22 : 18, formKey === 0 ? 8 : 10, formKey === 1 ? 6 : 5)} fill={palette.tertiary} />
            {formKey === 1 ? <circle cx="50" cy="26" r="18" fill="none" stroke={palette.secondary} strokeWidth="1.4" strokeOpacity="0.8" /> : null}
            {formKey === 2 ? <path d="M 60 36 Q 76 46 84 58" stroke={palette.secondary} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.7" /> : null}
            <circle cx="30" cy="50" r="7" fill={palette.primary} />
            <circle cx="70" cy="48" r="7" fill={palette.secondary} />
            <circle cx="50" cy="60" r="6" fill={palette.tertiary} />
            {renderRarityDecor()}
          </svg>
        )
      }
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]">
          <path d={`M 50 95 Q ${formKey === 1 ? 46 : 50} 50 ${50 + seedNudge * 0.3} 18`} stroke={palette.stem} strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M 50 72 Q 20 60 14 36 Q 34 42 50 60" fill={palette.secondary} />
          <path d="M 50 50 Q 80 42 86 18 Q 64 24 50 42" fill={palette.primary} />
          <circle cx="50" cy={formKey === 1 ? 16 : 20} r={formKey === 2 ? 16 : 13} fill={palette.primary} />
          <circle cx="36" cy="30" r={formKey === 0 ? 10 : 12} fill={palette.secondary} />
          <circle cx="65" cy="25" r={formKey === 1 ? 9 : 11} fill={palette.tertiary} />
          {renderRarityDecor()}
        </svg>
      )
    }
    if (level === 4) {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_25px_rgba(244,114,182,0.5)]">
          {isFlower ? (
            <>
              <path d="M 50 95 Q 50 55 50 28" stroke={palette.stem} strokeWidth="7" strokeLinecap="round" fill="none" />
              <ellipse cx="50" cy="22" rx={formKey === 1 ? 14 : 18} ry={formKey === 2 ? 16 : 12} fill={palette.primary} />
              <ellipse cx="36" cy="26" rx="10" ry="14" fill={palette.secondary} />
              <ellipse cx="64" cy="26" rx="10" ry="14" fill={palette.secondary} />
              <ellipse cx="50" cy="10" rx="10" ry="14" fill={palette.tertiary} />
              {formKey !== 0 ? <ellipse cx="50" cy="38" rx="10" ry="14" fill={palette.secondary} fillOpacity="0.72" /> : null}
              <circle cx="50" cy="22" r="6" fill="#fde68a" />
              {renderRarityDecor()}
            </>
          ) : (
            <>
              <path d="M 50 95 Q 50 50 50 20" stroke={palette.stem} strokeWidth="8" strokeLinecap="round" fill="none" />
              {isStar ? (
                <>
                  <polygon points={buildStarPoints(50, 24, formKey === 2 ? 24 : 20, formKey === 1 ? 10 : 8, formKey === 1 ? 6 : 5)} fill={palette.primary} />
                  {formKey === 1 ? <circle cx="50" cy="24" r="22" fill="none" stroke={palette.secondary} strokeWidth="1.5" strokeOpacity="0.75" /> : null}
                  {formKey === 2 ? <path d="M 63 37 Q 80 46 88 62" stroke={palette.secondary} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.78" /> : null}
                  <circle cx="35" cy="30" r="8" fill={palette.secondary} />
                  <circle cx="65" cy="25" r="8" fill={palette.tertiary} />
                  <circle cx="50" cy="58" r="8" fill={palette.secondary} />
                </>
              ) : (
                <>
                  <path d="M 50 70 Q 20 60 15 35 Q 35 40 50 60" fill={palette.secondary} />
                  <path d="M 50 50 Q 80 40 85 15 Q 65 20 50 40" fill={palette.primary} />
                  <circle cx="50" cy="20" r={formKey === 2 ? 18 : 15} fill={palette.primary} />
                  <circle cx="35" cy="30" r="12" fill={palette.secondary} />
                  <circle cx="65" cy="25" r="12" fill={palette.tertiary} />
                  <circle cx="50" cy="10" r="10" fill={palette.tertiary} />
                </>
              )}
              {renderRarityDecor()}
            </>
          )}
        </svg>
      )
    }
    // Level 5
    if (isTree) {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_30px_rgba(34,197,94,0.55)] animate-pulse">
          <path d={`M 50 96 Q ${formKey === 1 ? 46 : 48} 66 45 46 Q 42 32 50 18 Q ${58 + seedNudge * 0.5} 32 55 46 Q 52 66 50 96`} stroke={palette.stem} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="50" cy={formKey === 1 ? 18 : 22} r={formKey === 2 ? 24 : 20} fill={palette.primary} />
          <circle cx="30" cy="30" r={formKey === 0 ? 15 : 17} fill={palette.secondary} />
          <circle cx="70" cy="28" r={formKey === 1 ? 13 : 16} fill={palette.secondary} />
          <circle cx="50" cy="4" r="12" fill={palette.tertiary} />
          <circle cx="22" cy="16" r="10" fill={palette.tertiary} />
          <circle cx="78" cy="14" r="10" fill={palette.tertiary} />
          {formKey === 2 ? <circle cx="14" cy="28" r="8" fill={palette.secondary} fillOpacity="0.9" /> : null}
          {renderRarityDecor()}
        </svg>
      )
    }
    if (isFlower) {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_30px_rgba(244,114,182,0.6)] animate-pulse">
          <path d="M 50 96 Q 50 58 50 26" stroke={palette.stem} strokeWidth="8" strokeLinecap="round" fill="none" />
          <ellipse cx="50" cy="26" rx={formKey === 1 ? 18 : 24} ry={formKey === 2 ? 18 : 14} fill={palette.primary} />
          <ellipse cx="30" cy="30" rx="12" ry="18" fill={palette.secondary} />
          <ellipse cx="70" cy="30" rx="12" ry="18" fill={palette.secondary} />
          <ellipse cx="50" cy="8" rx="12" ry="18" fill={palette.tertiary} />
          <ellipse cx="50" cy="44" rx="12" ry="18" fill={palette.secondary} fillOpacity="0.88" />
          {formKey === 1 ? (
            <>
              <ellipse cx="22" cy="18" rx="9" ry="14" fill={palette.primary} fillOpacity="0.88" />
              <ellipse cx="78" cy="18" rx="9" ry="14" fill={palette.primary} fillOpacity="0.88" />
            </>
          ) : null}
          <circle cx="50" cy="26" r="8" fill="#fde68a" />
          {renderRarityDecor()}
        </svg>
      )
    }
    if (isStar) {
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_30px_rgba(192,38,211,0.6)] animate-pulse">
          <path d="M 50 95 Q 50 50 50 26" stroke={palette.stem} strokeWidth="10" strokeLinecap="round" fill="none" />
          <polygon points={buildStarPoints(50, 26, formKey === 2 ? 26 : 22, formKey === 1 ? 11 : 8, formKey === 1 ? 6 : 5)} fill={palette.tertiary} />
          {formKey === 1 ? <circle cx="50" cy="26" r="26" fill="none" stroke={palette.secondary} strokeWidth="1.8" strokeOpacity="0.78" /> : null}
          {formKey === 2 ? <path d="M 64 38 Q 83 48 92 66" stroke={palette.secondary} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.75" /> : null}
          <circle cx="28" cy="48" r="7" fill={palette.secondary} />
          <circle cx="72" cy="52" r="7" fill={palette.primary} />
          <circle cx="50" cy="62" r="8" fill={palette.secondary} />
          {renderRarityDecor()}
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_30px_rgba(192,38,211,0.6)] animate-pulse">
        <path d="M 50 95 Q 50 50 50 20" stroke={palette.stem} strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M 50 70 Q 20 60 10 30 Q 35 40 50 60" fill={palette.primary} opacity="0.8" />
        <path d="M 50 50 Q 80 40 90 10 Q 65 20 50 40" fill={palette.secondary} opacity="0.8" />
        <circle cx="50" cy="20" r="20" fill={palette.primary} />
        <circle cx="30" cy="30" r="16" fill={palette.secondary} />
        <circle cx="70" cy="25" r="16" fill={palette.tertiary} />
        <circle cx="50" cy="5" r="14" fill={palette.tertiary} />
        <circle cx="20" cy="15" r="10" fill={palette.tertiary} />
        <circle cx="80" cy="10" r="10" fill={palette.tertiary} />
        {renderRarityDecor()}
      </svg>
    )
  }

  return (
    <div ref={shellRef} className="flex flex-col items-center justify-center p-6 rounded-[2rem] border border-white/10 bg-panel-900/50 shadow-glow backdrop-blur overflow-hidden relative">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${routeInfo.auraClass}`} />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-tr ${rarityInfo.glowClass}`} />
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${levelUp ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.16),transparent_60%)]" />
      </div>
      <div ref={plantRef} className="relative mb-4">
        {levelUp ? (
          <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-brand-400/30 to-fuchsia-400/30 blur-2xl animate-pulse" />
        ) : null}
        {levelUp ? (
          <>
            {[...Array(8)].map((_, index) => (
              <span
                key={index}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-white/80 animate-ping"
                style={{
                  transform: `translate(${Math.cos((index / 8) * Math.PI * 2) * 34}px, ${Math.sin((index / 8) * Math.PI * 2) * 34}px)`,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            ))}
          </>
        ) : null}
        {renderSVG()}
        <div className="absolute -bottom-2 -z-10 h-4 w-16 -translate-x-1/2 left-1/2 rounded-[100%] bg-black/40 blur-[4px]"></div>
      </div>
      <div className={`text-lg font-bold ${stageInfo.color} tracking-tight`}>
        {stageInfo.name}
      </div>
      {showMeta ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${routeInfo.pillClass}`}>
            {routeInfo.label} · {routeInfo.description}
          </div>
          <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${rarityInfo.pillClass}`}>
            {rarityInfo.label} · {plantVariantName}
          </div>
        </div>
      ) : null}
      {levelUp ? (
        <div className="mt-2 rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1 text-[11px] font-semibold text-brand-100">
          形态升级！
        </div>
      ) : null}
      <div className="mt-1 text-xs font-medium text-white/50">
        本株成长值: {exp}
      </div>
      {stageInfo.level < 5 && (
        <div className="mt-4 w-full max-w-[200px]">
          <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
            <span>当前阶段</span>
            <span>离下一形态还差 {stageInfo.next - exp} Exp</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${routeInfo.progressClass} transition-all duration-1000 ease-out`}
              style={{ width: `${Math.max(2, stageInfo.progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
