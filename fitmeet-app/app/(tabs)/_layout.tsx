import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { palette } from '@/src/theme'

const tabIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  hub:           'radio-outline',
  meet:          'calendar-outline',
  notifications: 'notifications-outline',
  messages:      'chatbubble-ellipses-outline',
  profile:       'person-outline',
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#050816',
          borderTopColor: '#151c33',
          borderTopWidth: 1,
          paddingTop: 6,
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
    >
      <Tabs.Screen name="hub"           options={{ title: 'Hub' }}     />
      <Tabs.Screen name="meet"          options={{ title: 'Meet' }}    />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }}  />
      <Tabs.Screen name="messages"      options={{ title: 'Chat' }}    />
      <Tabs.Screen name="profile"       options={{ title: 'Profile' }} />
    </Tabs>
  )
}
