import { router, Tabs, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef, useState } from 'react'
import { AppState, BackHandler } from 'react-native'

import { palette } from '@/src/theme'
import { useAuthStore } from '@/src/store/auth'
import { api } from '@/src/lib/api'
import { consumeBackScrollToTop } from '@/src/lib/back-scroll'
import { emitChatRefresh } from '@/src/lib/chat-refresh'

const TAB_KEYS = ['hub', 'meet', 'ranks', 'notifications', 'messages', 'profile'] as const
type TabKey = typeof TAB_KEYS[number]

function normalizeTabPath(pathname: string): TabKey | null {
  const key = pathname.replace(/^\/\(tabs\)/, '').replace(/^\//, '')
  return (TAB_KEYS as readonly string[]).includes(key) ? (key as TabKey) : null
}

export const badgeEvents = {
  clearAlerts: () => {},
  clearChat: () => {},
}

const tabIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  hub:           'radio-outline',
  meet:          'calendar-outline',
  ranks:         'trophy-outline',
  notifications: 'pulse-outline',
  messages:      'chatbubble-ellipses-outline',
  profile:       'person-outline',
}

export default function TabsLayout() {
  const token = useAuthStore((state) => state.token)
  const pathname = usePathname()
  const [notifCount, setNotifCount] = useState(0)
  const [msgCount,   setMsgCount]   = useState(0)
  const appState = useRef(AppState.currentState)

  badgeEvents.clearAlerts = () => setNotifCount(0)
  badgeEvents.clearChat   = () => setMsgCount(0)

  // Nothing was ever telling iOS/Android what number to show on the app icon
  // itself -- setBadgeCountAsync() only takes effect while the app has been
  // opened/foregrounded recently (it doesn't update while fully killed;
  // that needs a `badge` field in the push payload instead), but that still
  // beats showing no badge at all, which is what happened before.
  useEffect(() => {
    Notifications.setBadgeCountAsync(notifCount + msgCount).catch(() => {})
  }, [notifCount, msgCount])

  // True tab-visit history: back returns to whichever tab was actually
  // visited before this one (like a browser back stack), exiting only once
  // that stack is exhausted. Nested screens within a tab (an event, a
  // conversation, etc.) aren't tab roots, so normalizeTabPath returns null
  // for them and the normal native stack-pop back behavior applies instead.
  const tabHistoryRef = useRef<TabKey[]>([])
  const isPoppingRef = useRef(false)

  useEffect(() => {
    const key = normalizeTabPath(pathname)
    if (!key) return

    if (isPoppingRef.current) {
      isPoppingRef.current = false
      return
    }
    const hist = tabHistoryRef.current
    if (hist[hist.length - 1] !== key) {
      hist.push(key)
    }
  }, [pathname])

  useEffect(() => {
    const key = normalizeTabPath(pathname)
    if (!key) return

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Hub, Meet's People/Events and Feed's Moments get first dibs on the
      // back press when scrolled down: it scrolls them to the top instead of
      // navigating away, and only a second press (now at the top) falls
      // through to popping the tab history below.
      if (consumeBackScrollToTop()) return true

      const hist = tabHistoryRef.current
      if (hist.length > 0 && hist[hist.length - 1] === key) {
        hist.pop()
      }
      const prev = hist[hist.length - 1]
      if (!prev) {
        BackHandler.exitApp()
      } else {
        isPoppingRef.current = true
        router.replace(`/(tabs)/${prev}` as never)
      }
      return true
    })

    return () => sub.remove()
  }, [pathname])

  useEffect(() => {
    if (!token) {
      setNotifCount(0)
      setMsgCount(0)
      return
    }

    function fetchCounts() {
      api.get('/notifications/count').then(({ data }) => {
        setNotifCount(data.count ?? 0)
      }).catch(() => {})
      api.get('/messages/unread-count').then(({ data }) => {
        setMsgCount(data.count ?? 0)
      }).catch(() => {})
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 30_000)

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchCounts()
      }
      appState.current = nextState
    })

    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [token])

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#050816',
          borderTopColor: '#151c33',
          borderTopWidth: 1,
          paddingTop: 6,
          marginBottom: 5,
        },
        tabBarActiveTintColor:   palette.accent,
        tabBarInactiveTintColor: palette.textDim,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcon[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        ),
      })}
      screenListeners={{
        tabPress: (e) => {
          const name = (e.target as string)?.split('-')[0]
          if (name === 'notifications') setNotifCount(0)
          if (name === 'messages') {
            setMsgCount(0)
            emitChatRefresh()
          }
        },
      }}
    >
      <Tabs.Screen name="hub"           options={{ title: 'Hub' }} />
      <Tabs.Screen name="meet"          options={{ title: 'Meet' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Feed', tabBarBadge: notifCount > 0 ? notifCount : undefined }} />
      <Tabs.Screen name="messages"      options={{ title: 'Chat',   tabBarBadge: msgCount   > 0 ? msgCount   : undefined }} />
      <Tabs.Screen name="ranks"         options={{ title: 'Ranks' }} />
      <Tabs.Screen name="profile"       options={{ title: 'Profile' }} />
    </Tabs>
  )
}
