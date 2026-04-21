import { create } from 'zustand'
import { getMe } from '../api/client'
import type { UserMe } from '../api/client'

type AuthState = {
  user: UserMe | null
  loading: boolean
  fetchUser: () => Promise<void>
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
}))
