import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL } from 'react-native-purchases'

const DEFAULT_SUPPORT_PRODUCT_IDS = ['beer_small', 'beer_medium', 'beer_large'] as const

const RC_GOOGLE_API_KEY =
  typeof Constants.expoConfig?.extra?.revenueCatGoogleApiKey === 'string'
    ? Constants.expoConfig.extra.revenueCatGoogleApiKey
    : ''

const RC_APPLE_API_KEY =
  typeof Constants.expoConfig?.extra?.revenueCatAppleApiKey === 'string'
    ? Constants.expoConfig.extra.revenueCatAppleApiKey
    : ''

const configuredSupportIds = Array.isArray(Constants.expoConfig?.extra?.revenueCatSupportProductIds)
  ? Constants.expoConfig.extra.revenueCatSupportProductIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  : []

export const SUPPORT_PRODUCT_IDS =
  configuredSupportIds.length > 0 ? [...new Set(configuredSupportIds)] : [...DEFAULT_SUPPORT_PRODUCT_IDS]

let configured = false
let currentAppUserId: string | null = null

function getApiKey() {
  return Platform.OS === 'ios' ? RC_APPLE_API_KEY : RC_GOOGLE_API_KEY
}

export function isRevenueCatEnabled() {
  return getApiKey().trim().length > 0
}

export async function setupRevenueCat(appUserId?: string | number | null) {
  if (!isRevenueCatEnabled()) return false

  const nextAppUserId = appUserId == null ? null : String(appUserId)
  if (!nextAppUserId) return false

  try {
    if (!configured) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN)
      Purchases.configure({
        apiKey: getApiKey(),
        appUserID: nextAppUserId,
      })
      configured = true
      currentAppUserId = nextAppUserId
      return true
    }

    if (nextAppUserId && currentAppUserId !== nextAppUserId) {
      await Purchases.logIn(nextAppUserId)
      currentAppUserId = nextAppUserId
    }

    return true
  } catch {
    return false
  }
}

export async function ensureRevenueCatUser(appUserId?: string | number | null) {
  const nextAppUserId = appUserId == null ? null : String(appUserId)
  if (!nextAppUserId) return false

  const ready = await setupRevenueCat(nextAppUserId)
  if (!ready) return false

  try {
    const activeAppUserId = await Purchases.getAppUserID()
    return activeAppUserId === nextAppUserId
  } catch {
    return false
  }
}

export function revenueCatKeyStatus() {
  return {
    enabled: isRevenueCatEnabled(),
    hasGoogleKey: RC_GOOGLE_API_KEY.trim().length > 0,
    hasAppleKey: RC_APPLE_API_KEY.trim().length > 0,
  }
}
