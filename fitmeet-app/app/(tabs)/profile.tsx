import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking } from 'react-native'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { api } from '@/src/lib/api'
import { syncPushToken, unregisterPushToken } from '@/src/lib/push-notifications'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const RADIUS_LABELS: Record<string, string> = {
  nearby: 'Nearby (50 km)',
  city: 'City (200 km)',
  region: 'Region (500 km)',
  unlimited: 'Unlimited',
}

type PrefField = 'email_friend_requests' | 'email_new_events' | 'email_event_reminders' | 'email_friend_events'

const PREF_ROWS: { field: PrefField; label: string; desc: string; icon: string }[] = [
  { field: 'email_friend_requests', label: 'Friend activity',       desc: 'Friend requests and accepted requests.',       icon: 'person-add-outline'    },
  { field: 'email_new_events',      label: 'New events near you',   desc: 'Events matching your interests and radius.',  icon: 'calendar-outline'      },
  { field: 'email_event_reminders', label: 'Event reminders',       desc: 'Reminder emails for events you joined.',      icon: 'notifications-outline' },
  { field: 'email_friend_events',   label: "Friends' new events",   desc: 'When a friend creates a new event.',          icon: 'people-outline'        },
]

const PREF_KEY: Record<PrefField, keyof NonNullable<ReturnType<typeof useAuthStore.getState>['user']>['email_preferences']> = {
  email_friend_requests: 'friend_requests',
  email_new_events:      'new_events',
  email_event_reminders: 'event_reminders',
  email_friend_events:   'friend_events',
}

export default function ProfileScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const user       = useAuthStore((s) => s.user)
  const logout     = useAuthStore((s) => s.logout)
  const refreshMe  = useAuthStore((s) => s.refreshMe)
  const [saving, setSaving]     = useState<PrefField | null>(null)
  const [prefError, setPrefError] = useState<string | null>(null)
  const [pushSaving, setPushSaving] = useState(false)

  async function togglePref(field: PrefField) {
    if (!user || saving !== null) return
    const key     = PREF_KEY[field]
    const current = user.email_preferences[key]
    setSaving(field)
    setPrefError(null)
    try {
      await api.patch('/me', { [field]: !current })
      await refreshMe()
    } catch {
      setPrefError('Could not save. Try again.')
    } finally {
      setSaving(null)
    }
  }

  async function togglePush() {
    if (!user || pushSaving) return

    setPushSaving(true)
    setPrefError(null)

    try {
      const next = !user.push_notifications
      await api.patch('/me', { push_notifications: next })
      await refreshMe()

      if (next) {
        try {
          await syncPushToken(true)
        } catch {}
      } else {
        try {
          await unregisterPushToken()
        } catch {}
      }
    } catch {
      setPrefError('Could not save push setting. Try again.')
    } finally {
      setPushSaving(false)
    }
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Profile</Text>
          <Text style={styles.title}>Your account</Text>
        </View>

        {/* Identity card */}
        <View style={styles.card}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            {user.phone ? (
              <View style={styles.row}>
                <Ionicons name="call-outline" size={12} color={palette.textDim} />
                <Text style={styles.phone}>{user.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Edit profile link */}
        <Pressable style={styles.settingsLink} onPress={() => router.push('/settings' as never)}>
          <Ionicons name="settings-outline" size={18} color={palette.accent} />
          <Text style={styles.settingsLinkText}>Edit profile & settings</Text>
          <Ionicons name="chevron-forward" size={16} color={palette.textDim} />
        </Pressable>

        {/* Location */}
        {user.home.city ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Location</Text>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={15} color={palette.accent} />
              <Text style={styles.rowText}>
                {user.home.city}{user.home.country ? `, ${user.home.country}` : ''}
              </Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="navigate-outline" size={15} color={palette.textDim} />
              <Text style={styles.rowText}>{RADIUS_LABELS[user.radius] ?? user.radius}</Text>
            </View>
          </View>
        ) : null}

        {/* Interests */}
        {(user.categories.length > 0 || user.skill_level) ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Interests</Text>
            {user.categories.length > 0 && (
              <View style={styles.tags}>
                {user.categories.map(cat => (
                  <View key={cat} style={styles.tag}>
                    <Text style={styles.tagText}>{cat.replace('_', ' ')}</Text>
                  </View>
                ))}
              </View>
            )}
            {user.skill_level ? (
              <Text style={styles.skillText}>
                Level: <Text style={styles.skillValue}>{user.skill_level}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Events shortcuts */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Events</Text>
          <Pressable style={styles.linkRow} onPress={() => router.push('/event/my' as never)}>
            <Ionicons name="calendar-outline" size={18} color={palette.accent} />
            <Text style={styles.linkText}>My Events</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.textDim} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/event/create' as never)}>
            <Ionicons name="add-circle-outline" size={18} color={palette.accent} />
            <Text style={styles.linkText}>Create New Event</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.textDim} />
          </Pressable>
        </View>

        {/* Email preferences */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Email settings</Text>
          <View style={styles.prefList}>
            {PREF_ROWS.map(({ field, label, desc, icon }) => {
              const enabled  = user.email_preferences[PREF_KEY[field]]
              const isSaving = saving === field
              return (
                <View key={field} style={styles.prefRow}>
                  <Ionicons
                    name={icon as 'person-add-outline'}
                    size={17}
                    color={enabled ? palette.accent : palette.textDim}
                    style={styles.prefIcon}
                  />
                  <View style={styles.prefText}>
                    <Text style={styles.prefLabel}>{label}</Text>
                    <Text style={styles.prefDesc}>{desc}</Text>
                  </View>
                  {isSaving ? (
                    <ActivityIndicator size="small" color={palette.accent} />
                  ) : (
                    <Pressable
                      onPress={() => togglePref(field)}
                      disabled={saving !== null}
                      style={[styles.toggle, enabled && styles.toggleOn]}
                    >
                      <View style={[styles.knob, enabled && styles.knobOn]} />
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
          {prefError ? <Text style={styles.errorText}>{prefError}</Text> : null}
        </View>

        {/* Push notifications */}
        <View style={styles.card}>
          <View style={styles.pushHeader}>
            <Text style={styles.sectionLabel}>Push notifications</Text>
          </View>
          <View style={styles.prefList}>
            <View style={styles.prefRow}>
              <Ionicons
                name="phone-portrait-outline"
                size={17}
                color={user.push_notifications ? palette.accent : palette.textDim}
                style={styles.prefIcon}
              />
              <View style={styles.prefText}>
                <Text style={styles.prefLabel}>Enable push notifications</Text>
                <Text style={styles.prefDesc}>Friend requests, accepted requests, messages, reminders and new events.</Text>
              </View>
              {pushSaving ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : (
                <Pressable onPress={togglePush} style={[styles.toggle, user.push_notifications && styles.toggleOn]}>
                  <View style={[styles.knob, user.push_notifications && styles.knobOn]} />
                </Pressable>
              )}
            </View>
            {[
              { icon: 'person-add-outline',    label: 'Friend requests',      desc: 'When someone sends you a friend request.' },
              { icon: 'people-outline',        label: 'Friend accepted',      desc: 'When someone accepts your request.' },
              { icon: 'calendar-outline',       label: 'New events near you',  desc: 'Events matching your interests.' },
              { icon: 'notifications-outline',  label: 'Event reminders',      desc: 'Before events you\'ve joined.' },
              { icon: 'chatbubble-outline',     label: 'New messages',         desc: 'When you receive a new message.' },
            ].map(({ icon, label, desc }) => (
              <View key={label} style={styles.prefRow}>
                <Ionicons name={icon as never} size={17} color={palette.textDim} style={styles.prefIcon} />
                <View style={styles.prefText}>
                  <Text style={styles.prefLabel}>{label}</Text>
                  <Text style={styles.prefDesc}>{desc}</Text>
                </View>
                <View style={[styles.toggle, user.push_notifications && styles.toggleOn]}>
                  <View style={[styles.knob, user.push_notifications && styles.knobOn]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Logout */}
        <Pressable
          onPress={async () => {
            await logout()
            router.replace('/welcome')
          }}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={18} color="#ff9b9b" />
          <Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>

        <Text style={styles.versionLabel}>FitMeet v1.0.3</Text>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },

  header:  { gap: 2 },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title:   { color: palette.text, fontSize: 30, fontWeight: '800' },

  card: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    gap: spacing.sm,
  },

  avatar:        { width: 72, height: 72, borderRadius: 18 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#041109', fontSize: 30, fontWeight: '800' },

  userInfo: { gap: 3 },
  name:     { color: palette.text, fontSize: 20, fontWeight: '800' },
  email:    { color: palette.textMuted, fontSize: 14 },
  phone:    { color: palette.textDim, fontSize: 13 },

  row:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { color: palette.textMuted, fontSize: 14, flex: 1 },

  sectionLabel: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },

  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.35)',
    backgroundColor: 'rgba(108,255,47,0.07)',
  },
  tagText:    { color: palette.accent, fontSize: 12, fontWeight: '700' },
  skillText:  { color: palette.textMuted, fontSize: 13 },
  skillValue: { color: palette.text, fontWeight: '700' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '600' },

  settingsLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md,
  },
  settingsLinkText: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '700' },

  pushHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  comingBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: palette.line },
  comingText:  { color: palette.textDim, fontSize: 11, fontWeight: '600' },

  prefList: { gap: 14 },
  prefRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  prefIcon: { marginTop: 1, width: 20 },
  prefText: { flex: 1, gap: 2 },
  prefLabel:{ color: palette.text, fontSize: 14, fontWeight: '700' },
  prefDesc: { color: palette.textDim, fontSize: 12 },

  toggle: {
    width: 48, height: 28, borderRadius: 999,
    backgroundColor: palette.panelRaised,
    borderWidth: 1, borderColor: palette.line,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  knob: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: palette.textDim,
  },
  knobOn: { backgroundColor: '#041109', alignSelf: 'flex-end' },

  errorText:  { color: '#f87171', fontSize: 12, marginTop: 4 },

  logoutBtn: {
    height: 52, borderRadius: 18,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.18)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  logoutLabel: { color: '#ff9b9b', fontSize: 15, fontWeight: '700' },
  versionLabel: { textAlign: 'center', color: palette.textDim, fontSize: 11, marginTop: 16, opacity: 0.5 },
})
