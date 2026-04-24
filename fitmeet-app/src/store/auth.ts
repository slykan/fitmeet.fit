import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

export interface MobileUser {
  id: number
  name: string
  email: string
}

type AuthState = {
  token: string | null
  user: MobileUser | null
  hasHydrated: boolean
  hydrate: () => Promise<void>
  setDemoSession: (input: { name: string; email: string }) => Promise<void>
  logout: () => Promise<void>
}

const STORAGE_KEY = 'fitmeet-mobile-auth'

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hasHydrated: false,
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Pick<AuthState, 'token' | 'user'>
      set({ token: parsed.token, user: parsed.user, hasHydrated: true })
      return
    }
    set({ hasHydrated: true })
  },
  setDemoSession: async ({ name, email }) => {
    const payload = {
      token: 'demo-session',
      user: {
        id: 1,
        name,
        email,
      },
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    set({ ...payload })
  },
  logout: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    set({ token: null, user: null })
  },
}))
