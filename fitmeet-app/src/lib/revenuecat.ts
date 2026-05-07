import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL } from 'react-native-purchases'

const DEFAULT_SUPPORT_PRODUCT_IDS = ['beer_small', 'beer_medium', 'beer_big'] as const

const RC_GOOGLE_API_KEY =
  typeof Constants.expoConfig?.extra?.revenueCatGoogleApiKey === 'string'
    ? Constants.expoConfig.extra.revenueCatGoogleApiKey
    : ''

const configuredSupportIds = Array.isArray(Constants.expoConfig?.extra?.revenueCatSupportProductIds)
  ? Constants.expoConfig.extra.revenueCatSupportProductIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  : []

export const SUPPORT_PRODUCT_IDS =
  configuredSupportIds.length > 0 ? configuredSupportIds : [...DEFAULT_SUPPORT_PRODUCT_IDS]

let configured = false
let currentAppUserId: string | null = null

export function isRevenueCatEnabled() {
  return Platform.OS === 'android' && RC_GOOGLE_API_KEY.trim().length > 0
}

export async function setupRevenueCat(appUserId?: string | number | null) {
  if (!isRevenueCatEnabled()) return false

  const nextAppUserId = appUserId == null ? null : String(appUserId)

  if (!configured) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN)
    Purchases.configure({
      apiKey: RC_GOOGLE_API_KEY,
      appUserID: nextAppUserId ?? undefined,
    })
    configured = true
    currentAppUserId = nextAppUserId
    return true
  }

  if (nextAppUserId && currentAppUserId !== nextAppUserId) {
    await Purchases.logIn(nextAppUserId)
    currentAppUserId = nextAppUserId
  } else if (!nextAppUserId && currentAppUserId) {
    await Purchases.logOut()
    currentAppUserId = null
  }

  return true
}

export function revenueCatKeyStatus() {
  return {
    enabled: isRevenueCatEnabled(),
    hasGoogleKey: RC_GOOGLE_API_KEY.trim().length > 0,
  }
}
