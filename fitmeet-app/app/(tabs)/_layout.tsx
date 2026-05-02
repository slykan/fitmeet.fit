import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { palette } from '@/src/theme'
import { useAuthStore } from '@/src/store/auth'
import { api } from '@/src/lib/api'

export const badgeEvents = {
  clearAlerts: () => {},
  clearChat: () => {},
}

const tabIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  hub:           'radio-outline',
  meet:          'calendar-outline',
  notifications: 'notifications-outline',
  messages:      'chatbubble-ellipses-outline',
  profile:       'person-outline',
}

export default function TabsLayout() {
  const token = useAuthStore((state) => state.token)
  const [notifCount, setNotifCount] = useState(0)
  const [msgCount,   setMsgCount]   = useState(0)
  const appState = useRef(AppState.currentState)

  badgeEvents.clearAlerts = () => setNotifCount(0)
  badgeEvents.clearChat   = () => setMsgCount(0)

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
          if (name === 'messages')      setMsgCount(0)
        },
      }}
    >
      <Tabs.Screen name="hub"           options={{ title: 'Hub' }} />
      <Tabs.Screen name="meet"          options={{ title: 'Meet' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarBadge: notifCount > 0 ? notifCount : undefined }} />
      <Tabs.Screen name="messages"      options={{ title: 'Chat',   tabBarBadge: msgCount   > 0 ? msgCount   : undefined }} />
      <Tabs.Screen name="profile"       options={{ title: 'Profile' }} />
    </Tabs>
  )
}
