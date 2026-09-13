import { router, Tabs, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef, useState } from 'react'
import { AppState, BackHandler } from 'react-native'

import { palette } from '@/src/theme'
import { useAuthStore } from '@/src/store/auth'
import { api } from '@/src/lib/api'
import { emitChatRefresh } from '@/src/lib/chat-refresh'

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

  useEffect(() => {
    const homePaths = new Set(['/hub', '/(tabs)/hub'])
    const tabPaths = new Set([
      '/hub',
      '/meet',
      '/ranks',
      '/notifications',
      '/messages',
      '/profile',
      '/(tabs)/hub',
      '/(tabs)/meet',
      '/(tabs)/ranks',
      '/(tabs)/notifications',
      '/(tabs)/messages',
      '/(tabs)/profile',
    ])
    if (!tabPaths.has(pathname)) return

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // On any other tab's root, back should land on the Hub tab first (the
      // "home" tab) rather than exiting straight away -- exiting is only
      // expected once you're already there. Nested screens within a tab
      // (an event, a conversation, etc.) aren't in tabPaths at all, so this
      // handler isn't registered for them and the normal stack-pop back
      // behavior already applies.
      if (homePaths.has(pathname)) {
        BackHandler.exitApp()
      } else {
        router.replace('/(tabs)/hub')
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
