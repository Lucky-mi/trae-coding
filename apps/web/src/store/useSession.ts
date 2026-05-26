import { create } from 'zustand'

export type PlantRoute = 'tree' | 'flower' | 'star'
export type PlantRarity = 'common' | 'rare' | 'epic'
// 测试阶段降低阈值，方便快速观察进化和入园链路
export const PLANT_MILESTONE_EXP = 80

export type PlantAppearance = {
  rarity: PlantRarity
  seed: number
  form: number
  accent: number
  variantName: string
}

export type ActivePlant = PlantAppearance & {
  route: PlantRoute
  cycle: number
}

export type GardenPlant = PlantAppearance & {
  id: string
  route: PlantRoute
  exp: number
  collectedAt: number
  nickname: string
  cycle: number
}

export function getPlantCycleExp(totalExp: number) {
  if (totalExp <= 0) return 0
  return totalExp % PLANT_MILESTONE_EXP
}

export function getPlantCycleIndex(totalExp: number) {
  return Math.floor(Math.max(0, totalExp) / PLANT_MILESTONE_EXP) + 1
}

export type SessionState = {
  deviceId: string
  guestId: string
  plantRoute: PlantRoute
  activePlant: ActivePlant
  gardenPlants: GardenPlant[]
  lastGardenExp: number
  history: Array<{
    id: string
    stage: '小学' | '初中' | '高中'
    correctRate: number
    total: number
    endedBy: 'quota' | 'time' | 'converge'
    ts: number
  }>
  addRecord: (r: Omit<SessionState['history'][number], 'id' | 'ts'>) => void
  setPlantRoute: (route: SessionState['plantRoute']) => void
  syncActivePlantCycle: (totalExp: number) => void
  collectGardenPlant: (exp: number) => GardenPlant
  collectMaturePlants: (exp: number) => GardenPlant[]
}

function getDeviceId() {
  const k = 'wordgauge-device-id'
  const existed = localStorage.getItem(k)
  if (existed) return existed
  const id = crypto.randomUUID()
  localStorage.setItem(k, id)
  return id
}

function getJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max)
}

function createPlantAppearance(route: PlantRoute): PlantAppearance {
  const variantNames = {
    tree: ['舒展枝', '冠羽枝', '苍穹冠'],
    flower: ['双瓣型', '流苏型', '月冠型'],
    star: ['新星型', '环星型', '彗尾型'],
  } as const
  const rarityRoll = Math.random()
  const rarity: PlantRarity = rarityRoll > 0.92 ? 'epic' : rarityRoll > 0.66 ? 'rare' : 'common'
  const form = randomInt(variantNames[route].length)
  return {
    rarity,
    seed: randomInt(1000000),
    form,
    accent: randomInt(3),
    variantName: variantNames[route][form],
  }
}

function createActivePlant(route: PlantRoute, cycle: number): ActivePlant {
  return {
    route,
    cycle,
    ...createPlantAppearance(route),
  }
}

function createGardenMeta(route: SessionState['plantRoute']): Pick<GardenPlant, 'nickname'> {
  const adjectives = {
    tree: ['青岚', '森语', '风栖', '暮松'],
    flower: ['朝露', '月莓', '绯樱', '轻霓'],
    star: ['星环', '月砂', '曜芒', '极光'],
  } as const
  const nouns = {
    tree: ['古树', '幼林', '枝冠', '灵木'],
    flower: ['花簇', '花灵', '花影', '花冠'],
    star: ['星芽', '星树', '星冠', '星簇'],
  } as const
  const nickname = `${adjectives[route][randomInt(adjectives[route].length)]}${nouns[route][randomInt(nouns[route].length)]}`
  return { nickname }
}

export const useSession = create<SessionState>()((set, get) => ({
  deviceId: getDeviceId(),
  guestId: getDeviceId(),
  plantRoute: (localStorage.getItem('wordgauge-plant-route') as SessionState['plantRoute']) || 'tree',
  activePlant: getJson('wordgauge-active-plant', createActivePlant((localStorage.getItem('wordgauge-plant-route') as SessionState['plantRoute']) || 'tree', 1)),
  gardenPlants: getJson('wordgauge-garden-plants', []),
  lastGardenExp: Number(localStorage.getItem('wordgauge-garden-last-exp') || '0'),
  history: [],
  addRecord: (r) =>
    set((s) => ({
      history: [
        {
          id: crypto.randomUUID(),
          ts: Date.now(),
          ...r,
        },
        ...s.history,
      ],
    })),
  setPlantRoute: (route) => {
    localStorage.setItem('wordgauge-plant-route', route)
    const nextActivePlant = createActivePlant(route, get().activePlant.cycle || 1)
    localStorage.setItem('wordgauge-active-plant', JSON.stringify(nextActivePlant))
    set({
      plantRoute: route,
      activePlant: nextActivePlant,
    })
  },
  syncActivePlantCycle: (totalExp) => {
    const state = get()
    const targetCycle = getPlantCycleIndex(totalExp)
    if (state.activePlant.cycle === targetCycle && state.activePlant.route === state.plantRoute) return
    const nextActivePlant = createActivePlant(state.plantRoute, targetCycle)
    localStorage.setItem('wordgauge-active-plant', JSON.stringify(nextActivePlant))
    set({ activePlant: nextActivePlant })
  },
  collectGardenPlant: (exp): GardenPlant => {
    const state = get()
    const meta = createGardenMeta(state.plantRoute)
    const plant: GardenPlant = {
      id: crypto.randomUUID(),
      route: state.plantRoute,
      exp,
      collectedAt: Date.now(),
      nickname: meta.nickname,
      cycle: state.activePlant.cycle,
      rarity: state.activePlant.rarity,
      seed: state.activePlant.seed,
      form: state.activePlant.form,
      accent: state.activePlant.accent,
      variantName: state.activePlant.variantName,
    }
    const nextGarden = [plant, ...state.gardenPlants].slice(0, 18)
    const nextActivePlant = createActivePlant(state.plantRoute, state.activePlant.cycle + 1)
    localStorage.setItem('wordgauge-garden-plants', JSON.stringify(nextGarden))
    localStorage.setItem('wordgauge-garden-last-exp', String(exp))
    localStorage.setItem('wordgauge-active-plant', JSON.stringify(nextActivePlant))
    set({
      activePlant: nextActivePlant,
      gardenPlants: nextGarden,
      lastGardenExp: exp,
    })
    return plant
  },
  collectMaturePlants: (exp): GardenPlant[] => {
    const collectedPlants: GardenPlant[] = []
    while (exp >= get().lastGardenExp + PLANT_MILESTONE_EXP) {
      const plant = get().collectGardenPlant(get().lastGardenExp + PLANT_MILESTONE_EXP)
      collectedPlants.push(plant)
    }
    return collectedPlants
  },
}))
