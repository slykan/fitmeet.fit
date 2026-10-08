import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'

// Automatic check-in: the OS watches a circle around each joined event's meeting point
// (geofencing — no continuous tracking) and wakes this task on arriving/leaving. The
// server checks the user in (or remembers an early arrival until check-in opens) and
// sends a "Checked in" push, which a paired watch also shows — no watch app needed.
export const AUTO_CHECKIN_TASK_NAME = 'fitmeet-auto-checkin'
const REGION_PREFIX = 'event:'
const RADIUS_M = 200

type GeofenceEvent = { eventType: Location.GeofencingEventType; region: Location.LocationRegion }

async function ensureSession(): Promise<boolean> {
  // A geofence can wake the app headless (no screen mounted, store not hydrated yet).
  const state = useAuthStore.getState()
  if (!state.hasHydrated) await state.hydrate()
  return !!useAuthStore.getState().token
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 150 }).catch(() => null)
  const fix = recent ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)
  return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null
}

// Must be defined at module top level (before any component mounts)
TaskManager.defineTask(AUTO_CHECKIN_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return
  const { eventType, region } = (data ?? {}) as Partial<GeofenceEvent>
  const eventId = region?.identifier?.startsWith(REGION_PREFIX) ? region.identifier.slice(REGION_PREFIX.length) : null
  if (!eventId || !(await ensureSession())) return

  const inside = eventType === Location.GeofencingEventType.Enter
  try {
    if (inside) {
      // The server checks the real position against the meeting point, not the region.
      const position = await currentPosition()
      if (!position) return
      const { data: result } = await api.post(`/events/${eventId}/presence`, { inside: true, ...position })
      if (result?.checked_in) await syncAutoCheckInGeofences()
    } else {
      await api.post(`/events/${eventId}/presence`, { inside: false })
    }
  } catch {
    // too far / window closed / offline — the manual Check in button still works
  }
})

async function hasBackgroundLocation(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync().catch(() => null)
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null)
  return fg?.status === 'granted' && bg?.status === 'granted'
}

async function stopGeofences() {
  const started = await Location.hasStartedGeofencingAsync(AUTO_CHECKIN_TASK_NAME).catch(() => false)
  if (started) await Location.stopGeofencingAsync(AUTO_CHECKIN_TASK_NAME).catch(() => {})
}

/** Re-register the meeting points to watch: on app start, after join/leave and after a check-in. */
export async function syncAutoCheckInGeofences() {
  const user = useAuthStore.getState().user
  if (!user?.auto_check_in || !(await hasBackgroundLocation())) {
    await stopGeofences()
    return
  }

  try {
    const { data } = await api.get('/check-in/geofences')
    const events = (data?.data ?? []) as { id: number; lat: number; lng: number }[]
    if (!events.length) {
      await stopGeofences()
      return
    }
    await Location.startGeofencingAsync(AUTO_CHECKIN_TASK_NAME, events.map(e => ({
      identifier: `${REGION_PREFIX}${e.id}`,
      latitude: e.lat,
      longitude: e.lng,
      radius: RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: true,
    })))
  } catch {
    // offline — keep whatever was registered before
  }
}

export type EnableResult = 'enabled' | 'no-location' | 'no-background'

/** Ask for location "Allow all the time" (once), then switch automatic check-in on. */
export async function enableAutoCheckIn(): Promise<EnableResult> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') return 'no-location'
  const bg = await Location.requestBackgroundPermissionsAsync()
  if (bg.status !== 'granted') return 'no-background'

  await api.patch('/me', { auto_check_in: true })
  await useAuthStore.getState().refreshMe()
  await syncAutoCheckInGeofences()
  return 'enabled'
}

export async function disableAutoCheckIn() {
  await api.patch('/me', { auto_check_in: false })
  await useAuthStore.getState().refreshMe()
  await stopGeofences()
}
