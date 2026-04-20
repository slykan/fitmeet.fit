import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  name: string
  email: string
  avatar: string | null
  phone: string | null
  location: { lat: number | null; lng: number | null }
  home: { lat: number | null; lng: number | null; city: string | null; country: string | null }
  radius: 'nearby' | 'city' | 'region' | 'unlimited'
  radius_km: number
  categories: string[]
  skill_level: 'beginner' | 'advanced' | 'pro' | null
  onboarding_complete: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'fitmeet-auth' }
  )
)
