import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { Platform } from 'react-native'

import { api } from '@/src/lib/api'

export const LOCATION_TASK_NAME = 'fitmeet-live-location'
const TRACKED_EVENT_STORAGE_KEY = 'fitmeet-live-location-event-id'

type StartResult = {
  started: boolean
  background: boolean
}

function speedKmh(speedMs: number | null | undefined): number | null {
  return speedMs != null && speedMs >= 0 ? Math.round(speedMs * 3.6 * 10) / 10 : null
}

// `timeInterval: 5000` passed to both watchPositionAsync and
// startLocationUpdatesAsync below is only a hint -- with distanceInterval: 0,
// some Android GPS chips/OEMs ignore it entirely and deliver fixes far faster
// than requested (observed: one device posting ~15 fixes/sec for two hours
// straight, ballooning a single event to 100k+ location rows). Gate on the
// fix's own timestamp rather than trusting native throttling, so a burst of
// rapid-fire duplicates gets filtered regardless of what the OS actually
// delivers. This also correctly keeps every fix in a legitimate background
// catch-up burst, since those are already spaced apart in real time.
const MIN_FIX_INTERVAL_MS = 4000

let lastKeptFixAtMs = 0

function shouldKeepFix(timestampMs: number): boolean {
  if (timestampMs - lastKeptFixAtMs < MIN_FIX_INTERVAL_MS) return false
  lastKeptFixAtMs = timestampMs
  return true
}

// Must be defined at module top level (before any component mounts)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return

  const eventId = await AsyncStorage.getItem(TRACKED_EVENT_STORAGE_KEY)
  if (!eventId) return

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations
  if (!locations?.length) return

  // The OS can deliver several buffered fixes in one callback after a signal
  // gap or background suspension -- posting only the last one silently threw
  // the rest away, and even that lone point got stamped with the *server's*
  // receive time (see EventController::updateLocation), not when it was
  // actually recorded. A catch-up burst of posts a few seconds apart in real
  // time then all landed within the same second or two server-side despite
  // covering several real minutes on the ground, corrupting the recorded
  // chronology enough that route replay draws an instant "teleport" between
  // them. Post every fix, each with its own device timestamp, in order.
  for (const location of locations) {
    if (!shouldKeepFix(location.timestamp)) continue

    try {
      await api.post(`/events/${eventId}/location`, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed_kmh: speedKmh(location.coords.speed),
        recorded_at: new Date(location.timestamp).toISOString(),
        fix_at_ms: location.timestamp,
      })
    } catch {
      // Event ended / sharing disabled elsewhere — just skip this beat.
    }
  }
})

export async function startLiveLocationTracking(eventId: number | string): Promise<StartResult> {
  const foreground = await Location.requestForegroundPermissionsAsync()
  if (foreground.status !== 'granted') {
    return { started: false, background: false }
  }

  const background = await Location.requestBackgroundPermissionsAsync()
  const hasBackground = background.status === 'granted'

  await AsyncStorage.setItem(TRACKED_EVENT_STORAGE_KEY, String(eventId))
  lastKeptFixAtMs = 0

  try {
    await api.post(`/events/${eventId}/location-sharing`, { enabled: true })
  } catch {
    await AsyncStorage.removeItem(TRACKED_EVENT_STORAGE_KEY)
    return { started: false, background: false }
  }

  if (hasBackground) {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        // 0, not a displacement filter -- a rider stopped dead still (e.g. a
        // beer break) needs beats to keep arriving so the server's stopped-anchor
        // logic (EventController::updateLocation) and the 3-minute live-positions
        // freshness window both keep seeing them, instead of the rider silently
        // vanishing from the map after distance-filtered updates dry up.
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'FitMeet',
          notificationBody: 'Sharing your live location with event participants',
        },
      })
    }
  } else {
    // Foreground-only fallback: the event screen's own polling effect posts
    // positions while it's mounted; nothing to start here.
  }

  return { started: true, background: hasBackground }
}

export async function stopLiveLocationTracking(eventId?: number | string) {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {})
  }
  await AsyncStorage.removeItem(TRACKED_EVENT_STORAGE_KEY)

  const targetEventId = eventId ?? null
  if (targetEventId) {
    await api.post(`/events/${targetEventId}/location-sharing`, { enabled: false }).catch(() => {})
  }
}

export async function getTrackedLiveLocationEventId(): Promise<string | null> {
  return AsyncStorage.getItem(TRACKED_EVENT_STORAGE_KEY)
}

export async function postForegroundLocation(eventId: number | string, location: Location.LocationObject) {
  if (!shouldKeepFix(location.timestamp)) return

  try {
    await api.post(`/events/${eventId}/location`, {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      speed_kmh: speedKmh(location.coords.speed),
      recorded_at: new Date(location.timestamp).toISOString(),
      fix_at_ms: location.timestamp,
    })
  } catch {
    // ignore — next tick will retry
  }
}

export function openAndroidBatteryOptimizationSettings() {
  if (Platform.OS !== 'android') return
  const packageName = Constants.expoConfig?.android?.package
  if (!packageName) return

  IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
    data: `package:${packageName}`,
  }).catch(() => {})
}
