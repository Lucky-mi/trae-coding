import { create } from 'zustand'
import { bindGuestToUser, getMe } from '../api/client'
import { useSession } from './useSession'
import type { UserMe } from '../api/client'

type AuthState = {
  user: UserMe | null
  loading: boolean
  fetchUser: () => Promise<void>
  setUserProgress: (patch: Partial<UserMe>) => void
  bindGuestHistory: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const user = await getMe()
      set({ user, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
  setUserProgress: (patch) => set((state) => ({ user: state.user ? { ...state.user, ...patch } : null })),
  bindGuestHistory: async () => {
    const guestId = useSession.getState().guestId
    try {
      await bindGuestToUser(guestId)
    } catch {
      // ignore bind failures; anonymous mode should not block login
    }
  },
}))
