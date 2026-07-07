import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Easing, Image, Modal,
  Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { presentUserModerationMenu } from '@/src/lib/moderation'
import { palette, spacing } from '@/src/theme'

interface UserProfile {
  id: number
  name: string
  avatar: string | null
  home: { city: string | null; country: string | null }
  categories: string[]
  skill_level: string | null
  member_since: string | null
  is_self: boolean
  friendship_status: 'friends' | 'pending_sent' | 'pending_received' | null
  beer_score: number
  is_blocked: boolean
  stats: {
    events_created: number
    events_joined:  number
    check_ins:      number
    comments:       number
    moments:        number
    beers:          number
  }
}

const STAT_ROWS: { key: keyof UserProfile['stats']; label: string; emoji: string; color: string }[] = [
  { key: 'events_created', label: 'Events created', emoji: '🗓',  color: '#39ff14' },
  { key: 'events_joined',  label: 'Events joined',  emoji: '🏃',  color: '#00a8ff' },
  { key: 'check_ins',      label: 'Check-ins',      emoji: '✅',  color: '#fbbf24' },
  { key: 'comments',       label: 'Comments',        emoji: '💬',  color: '#a78bfa' },
  { key: 'moments',        label: 'Moments',         emoji: '📸',  color: '#fb923c' },
  { key: 'beers',          label: 'Beers bought',   emoji: '🍺',  color: '#f59e0b' },
]

function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [anim, pct, delay])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom,    setZoom]    = useState(false)
  const [acting,  setActing]  = useState(false)

  useEffect(() => {
    api.get(`/users/${id}`)
      .then(({ data }) => setProfile(data))
      .catch(() => router.back())
      .finally(() => setLoading(false))
  }, [id])

  async function handleFriendAction() {
    if (!profile || acting) return
    setActing(true)
    try {
      if (profile.friendship_status === null) {
        await api.post(`/friends/request/${profile.id}`)
        setProfile(p => p ? { ...p, friendship_status: 'pending_sent' } : p)
      } else if (profile.friendship_status === 'pending_received') {
        const requestId = await api.get('/notifications').then(({ data }) => {
          const request = data.data?.find((n: { type: string; id: number; sender?: { id: number } }) =>
            n.type === 'friend_request' && n.sender?.id === profile.id
          )
          return request?.id ?? null
        }).catch(() => null)
        if (requestId) {
          await api.post(`/friends/accept/${requestId}`)
          setProfile(p => p ? { ...p, friendship_status: 'friends' } : p)
        }
      } else if (profile.friendship_status === 'friends') {
        await api.delete(`/friends/${profile.id}`)
        setProfile(p => p ? { ...p, friendship_status: null } : p)
      }
    } catch {}
    setActing(false)
  }

  function handleMorePress() {
    if (!profile) return
    presentUserModerationMenu({
      userId: profile.id,
      userName: profile.name,
      isBlocked: profile.is_blocked,
      onBlockedChange: () => {
        if (profile.is_blocked) {
          setProfile(p => p ? { ...p, is_blocked: false } : p)
        } else {
          router.back()
        }
      },
    })
  }

  async function shareProfile() {
    if (!profile) return

    const url = `https://fitmeet.fit/users/view?id=${profile.id}`
    const stats = profile.stats
    const categories = profile.categories.length
      ? `\nSports: ${profile.categories.map(cat => cat.replace('_', ' ')).join(', ')}`
      : ''

    await Share.share({
      title: `${profile.name} on FitMeet`,
      message: [
        `${profile.name}'s FitMeet profile`,
        '',
        `Alibi score: ${total}`,
        `Joined ${stats.events_joined} events, checked in ${stats.check_ins} times, created ${stats.events_created} events.${categories}`,
        '',
        url,
      ].join('\n'),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={palette.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (!profile) return null

  const maxVal = Math.max(1, ...Object.values(profile.stats))
  const total  = Object.values(profile.stats).reduce((a, b) => a + b, 0)

  const verdict =
    total === 0   ? '😴 Just joined'     :
    total < 10    ? '🚶 Getting started' :
    total < 30    ? '🏃 Picking up pace' :
    total < 60    ? '💪 Solid presence'  :
    total < 100   ? '🔥 Highly active'   : '⚡ Local legend'

  const friendLabel =
    profile.friendship_status === 'friends'         ? '✓ Friends'      :
    profile.friendship_status === 'pending_sent'    ? 'Request sent'   :
    profile.friendship_status === 'pending_received'? 'Accept request' : 'Add friend'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Avatar zoom */}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoomOverlay} onPress={() => setZoom(false)}>
          {profile.avatar && (
            <Image source={{ uri: profile.avatar }} style={styles.zoomImg} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        {/* Avatar + info */}
        <View style={styles.heroRow}>
          <Pressable onPress={() => profile.avatar && setZoom(true)} disabled={!profile.avatar}>
            {profile.avatar
              ? <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
                </View>
              )
            }
          </Pressable>

          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
              {profile.beer_score > 0 && (
                <View style={styles.beerBadge}>
                  <Text style={styles.beerBadgeText}>🍺 ×{profile.beer_score}</Text>
                </View>
              )}
            </View>
            {(profile.home.city || profile.home.country) && (
              <Text style={styles.meta}>📍 {[profile.home.city, profile.home.country].filter(Boolean).join(', ')}</Text>
            )}
            {profile.skill_level && (
              <Text style={styles.meta}>⭐ {profile.skill_level}</Text>
            )}
            {profile.member_since && (
              <Text style={styles.memberSince}>Member since {formatDate(profile.member_since)}</Text>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          {!profile.is_self && (
            <Pressable
              style={[styles.friendBtn, profile.friendship_status === 'friends' && styles.friendBtnActive]}
              onPress={handleFriendAction}
              disabled={acting || profile.friendship_status === 'pending_sent'}
            >
              {acting
                ? <ActivityIndicator size="small" color={palette.accent} />
                : <Text style={[styles.friendBtnLabel, profile.friendship_status === 'friends' && styles.friendBtnLabelActive]}>
                    {friendLabel}
                  </Text>
              }
            </Pressable>
          )}
          <Pressable style={styles.shareBtn} onPress={shareProfile}>
            <Ionicons name="share-social-outline" size={17} color={palette.accent} />
            <Text style={styles.shareBtnLabel}>Share</Text>
          </Pressable>
          {!profile.is_self && (
            <Pressable style={styles.moreBtn} onPress={handleMorePress} hitSlop={10}>
              <Ionicons name="ellipsis-horizontal" size={18} color={palette.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Categories */}
        {profile.categories.length > 0 && (
          <View style={styles.tagsRow}>
            {profile.categories.map(cat => (
              <View key={cat} style={styles.tag}>
                <Text style={styles.tagText}>{cat.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Score card */}
        <View style={styles.scoreCard}>
          <View>
            <Text style={styles.scoreLabel}>Activity score</Text>
            <Text style={styles.scoreValue}>{total}</Text>
          </View>
          <Text style={styles.verdict}>{verdict}</Text>
        </View>

        {/* Alibi bars */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🕵️ Alibi</Text>
          <View style={styles.bars}>
            {STAT_ROWS.map(({ key, label, emoji, color }, i) => {
              const val = profile.stats[key]
              const pct = (val / maxVal) * 100
              return (
                <View key={key} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{emoji} {label}</Text>
                    <Text style={[styles.barValue, { color }]}>{val}</Text>
                  </View>
                  <AnimatedBar pct={pct} color={color} delay={i * 60} />
                </View>
              )
            })}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },

  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backLabel: { color: palette.text, fontSize: 15, fontWeight: '600' },

  heroRow:  { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatar:   { width: 88, height: 88, borderRadius: 22 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 22,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#041109', fontSize: 34, fontWeight: '800' },

  heroInfo: { flex: 1, gap: 4 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:     { color: palette.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  beerBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  beerBadgeText: { color: '#f59e0b', fontSize: 11, fontWeight: '700' },
  meta:         { color: palette.textMuted, fontSize: 13 },
  memberSince:  { color: palette.textDim, fontSize: 11 },

  actionRow: { flexDirection: 'row', gap: 10 },
  friendBtn: {
    flex: 1,
    height: 44, borderRadius: 16,
    borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  friendBtnActive: { borderColor: 'rgba(57,255,20,0.35)', backgroundColor: 'rgba(57,255,20,0.08)' },
  friendBtnLabel:  { color: palette.text, fontSize: 14, fontWeight: '700' },
  friendBtnLabelActive: { color: palette.accent },
  shareBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.28)',
    backgroundColor: 'rgba(57,255,20,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  shareBtnLabel: { color: palette.accent, fontSize: 14, fontWeight: '800' },
  moreBtn: {
    width: 44, height: 44, borderRadius: 16,
    borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)',
    backgroundColor: 'rgba(108,255,47,0.07)',
  },
  tagText: { color: palette.accent, fontSize: 12, fontWeight: '700' },

  scoreCard: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(57,255,20,0.2)',
    padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  scoreLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  scoreValue: { color: palette.accent, fontSize: 36, fontWeight: '900' },
  verdict:    { color: palette.text, fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line,
    padding: spacing.md, gap: spacing.md,
  },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },

  bars: { gap: 14 },
  barRow: { gap: 6 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  barValue: { fontSize: 13, fontWeight: '800' },

  track: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 999 },

  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  zoomImg: { width: '90%', height: '80%', borderRadius: 16 },
})
