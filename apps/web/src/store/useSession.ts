import { create } from 'zustand'

type SessionState = {
  deviceId: string
  history: Array<{
    id: string
    stage: '小学' | '初中' | '高中'
    correctRate: number
    total: number
    endedBy: 'quota' | 'time' | 'converge'
    ts: number
  }>
  addRecord: (r: Omit<SessionState['history'][number], 'id' | 'ts'>) => void
}

function getDeviceId() {
  const k = 'wordgauge-device-id'
  const existed = localStorage.getItem(k)
  if (existed) return existed
  const id = crypto.randomUUID()
  localStorage.setItem(k, id)
  return id
}

export const useSession = create<SessionState>((set) => ({
  deviceId: getDeviceId(),
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
}))
