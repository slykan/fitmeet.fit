import Constants from 'expo-constants'
import axios from 'axios'

import { useAuthStore } from '@/src/store/auth'

const fallbackUrl = 'https://api.fitmeet.fit/api'
const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? fallbackUrl,
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authorization = error.config?.headers?.Authorization ?? error.config?.headers?.authorization
    if (error.response?.status === 401 && authorization && useAuthStore.getState().token) {
      await useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)
