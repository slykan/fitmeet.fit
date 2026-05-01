import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { create } from 'zustand'

export interface MobileUser {
  id: number
  name: string
  email: string
  avatar: string | null
  phone: string | null
  hide_phone: boolean
  email_preferences: {
    friend_requests: boolean
    new_events: boolean
    event_reminders: boolean
    friend_events: boolean
  }
  push_notifications: boolean
  location: { lat: number | null; lng: number | null }
  home: { lat: number | null; lng: number | null; city: string | null; country: string | null }
  radius: 'nearby' | 'city' | 'region' | 'unlimited'
  radius_km: number
  categories: string[]
  skill_level: 'beginner' | 'advanced' | 'pro' | null
  onboarding_complete: boolean
}

type AuthState = {
  token: string | null
  user: MobileUser | null
  hasHydrated: boolean
  hydrate: () => Promise<void>
  login: (input: { email: string; password: string; turnstileToken: string }) => Promise<void>
  register: (input: { name: string; email: string; password: string; turnstileToken: string }) => Promise<void>
  loginWithGoogle: (accessToken: string) => Promise<void>
  refreshMe: () => Promise<void>
  logout: () => Promise<void>
}

const STORAGE_KEY = 'fitmeet-mobile-auth-v2'
const PUSH_TOKEN_STORAGE_KEY = 'fitmeet-mobile-push-token-v1'
const fallbackUrl = 'https://api.fitmeet.fit/api'
const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? fallbackUrl

async function storeSession(input: { token: string; user: MobileUser }) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(input))
}

async function requestJson<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message ?? 'Something went wrong.')
  }
  return data as T
}

type AuthResponse = {
  token: string
  data: MobileUser
}

type MeResponse = {
  data: MobileUser
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hasHydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Pick<AuthState, 'token' | 'user'>
        set({ token: parsed.token, user: parsed.user, hasHydrated: true })
        if (parsed.token) {
          requestJson<MeResponse>('/me', undefined, parsed.token)
            .then(async (payload) => {
              await storeSession({ token: parsed.token!, user: payload.data })
              set({ user: payload.data })
            })
            .catch(() => {})
        }
        return
      }
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY)
    }
    set({ hasHydrated: true })
  },
  login: async ({ email, password, turnstileToken }) => {
    const payload = await requestJson<AuthResponse>('/auth/login-mobile', {
      method: 'POST',
      body: JSON.stringify({ email, password, cf_turnstile_response: turnstileToken }),
    })
    await storeSession({ token: payload.token, user: payload.data })
    set({ token: payload.token, user: payload.data })
  },
  register: async ({ name, email, password, turnstileToken }) => {
    const payload = await requestJson<AuthResponse>('/auth/register-mobile', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, cf_turnstile_response: turnstileToken }),
    })
    await storeSession({ token: payload.token, user: payload.data })
    set({ token: payload.token, user: payload.data })
  },
  loginWithGoogle: async (accessToken: string) => {
    const payload = await requestJson<AuthResponse>('/auth/google-mobile', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    })
    await storeSession({ token: payload.token, user: payload.data })
    set({ token: payload.token, user: payload.data })
  },
  refreshMe: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    const payload = await requestJson<MeResponse>('/me', undefined, token)
    await storeSession({ token, user: payload.data })
    set({ user: payload.data })
  },
  logout: async () => {
    const token = useAuthStore.getState().token
    if (token) {
      try {
        const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)
        if (pushToken) {
          await requestJson('/me/push-token', {
            method: 'DELETE',
            body: JSON.stringify({ token: pushToken }),
          }, token)
        }
      } catch {}

      try {
        await requestJson('/logout', { method: 'POST' }, token)
      } catch {}
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
    await AsyncStorage.removeItem(STORAGE_KEY)
    set({ token: null, user: null })
  },
}))
