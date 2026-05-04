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
  push_notifications: boolean | null
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
  loginWithStrava: (code: string) => Promise<void>
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

function normalizeUser(user: MobileUser): MobileUser {
  return {
    ...user,
    avatar: user.avatar ?? null,
    phone: user.phone ?? null,
    hide_phone: user.hide_phone ?? false,
    email_preferences: {
      friend_requests: user.email_preferences?.friend_requests ?? true,
      new_events: user.email_preferences?.new_events ?? true,
      event_reminders: user.email_preferences?.event_reminders ?? true,
      friend_events: user.email_preferences?.friend_events ?? true,
    },
    push_notifications: user.push_notifications ?? true,
    location: user.location ?? { lat: null, lng: null },
    home: user.home ?? { lat: null, lng: null, city: null, country: null },
    radius: user.radius ?? 'nearby',
    radius_km: user.radius_km ?? 50,
    categories: user.categories ?? [],
    skill_level: user.skill_level ?? null,
    onboarding_complete: user.onboarding_complete ?? false,
  }
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
        const normalizedUser = parsed.user ? normalizeUser(parsed.user) : null
        set({ token: parsed.token, user: normalizedUser, hasHydrated: true })
        if (parsed.token) {
          requestJson<MeResponse>('/me', undefined, parsed.token)
            .then(async (payload) => {
              const user = normalizeUser(payload.data)
              await storeSession({ token: parsed.token!, user })
              set({ user })
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
    const user = normalizeUser(payload.data)
    await storeSession({ token: payload.token, user })
    set({ token: payload.token, user })
  },
  register: async ({ name, email, password, turnstileToken }) => {
    const payload = await requestJson<AuthResponse>('/auth/register-mobile', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, cf_turnstile_response: turnstileToken }),
    })
    const user = normalizeUser(payload.data)
    await storeSession({ token: payload.token, user })
    set({ token: payload.token, user })
  },
  loginWithGoogle: async (accessToken: string) => {
    const payload = await requestJson<AuthResponse>('/auth/google-mobile', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    })
    const user = normalizeUser(payload.data)
    await storeSession({ token: payload.token, user })
    set({ token: payload.token, user })
  },
  loginWithStrava: async (code: string) => {
    const payload = await requestJson<AuthResponse>('/strava/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    const user = normalizeUser(payload.data)
    await storeSession({ token: payload.token, user })
    set({ token: payload.token, user })
  },
  refreshMe: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    const payload = await requestJson<MeResponse>('/me', undefined, token)
    const user = normalizeUser(payload.data)
    await storeSession({ token, user })
    set({ user })
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
