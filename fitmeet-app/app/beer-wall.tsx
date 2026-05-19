import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SupportFitMeetCard } from '@/src/components/SupportFitMeetCard'
import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

type Donor = { name: string; beer_score: number; beer_top_tier: string; last_donation_at: string }

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
function isRecent(d: Donor) {
  return Date.now() - new Date(d.last_donation_at).getTime() < THIRTY_DAYS_MS
}

const MEDAL: Record<string, { label: string; icons: number; crate?: boolean }> = {
  beer_small:  { label: 'Small beer',   icons: 1 },
  beer_medium: { label: '3 beers',      icons: 3 },
  beer_large:  { label: 'Full crate',   icons: 1, crate: true },
}

function MedalIcons({ productId }: { productId: string }) {
  const m = MEDAL[productId]
  if (!m) return null
  if (m.crate) {
    return (
      <View style={styles.medalRow}>
        <Ionicons name="cube" size={14} color="#f6c65b" />
        <Ionicons name="cube" size={14} color="#f6c65b" />
        <Ionicons name="cube" size={14} color="#f6c65b" />
      </View>
    )
  }
  return (
    <View style={styles.medalRow}>
      {Array.from({ length: m.icons }).map((_, i) => (
        <Ionicons key={i} name="beer-outline" size={14} color="#f6c65b" />
      ))}
    </View>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={styles.trophy}>🏆</Text>
  if (rank === 2) return <Text style={styles.trophy}>🥈</Text>
  if (rank === 3) return <Text style={styles.trophy}>🥉</Text>
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankText}>{rank}</Text>
    </View>
  )
}

function DonorRow({ donor, rank }: { donor: Donor; rank: number }) {
  const m = MEDAL[donor.beer_top_tier]
  return (
    <View style={styles.donorRow}>
      <RankBadge rank={rank} />
      <View style={styles.donorInfo}>
        <Text style={styles.donorName}>{donor.name}</Text>
        <Text style={styles.donorLevel}>{m?.label ?? donor.beer_top_tier} · ×{donor.beer_score}</Text>
      </View>
      <MedalIcons productId={donor.beer_top_tier} />
    </View>
  )
}

function OlderDonorRow({ donor }: { donor: Donor }) {
  const daysAgo = Math.floor((Date.now() - new Date(donor.last_donation_at).getTime()) / (24 * 60 * 60 * 1000))
  return (
    <View style={[styles.donorRow, { opacity: 0.45 }]}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <Ionicons name="beer-outline" size={18} color="rgba(246,198,91,0.5)" />
      </View>
      <View style={styles.donorInfo}>
        <Text style={styles.donorName}>{donor.name}</Text>
        <Text style={styles.donorLevel}>{daysAgo}d ago · ×{donor.beer_score}</Text>
      </View>
    </View>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={styles.sectionLabel}>{text}</Text>
  )
}

export default function BeerWallScreen() {
  const [donors, setDonors] = useState<Donor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/beer-donations?limit=200')
      .then(r => setDonors(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleShare() {
    Share.share({
      message:
        'FitMeet stays free thanks to these people 🍺\n' +
        'Join the Wall of Fame — buy a beer, appear on every screen!\n' +
        'https://fitmeet.fit/supporters',
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Ionicons name="beer" size={18} color="#f6c65b" />
          <Text style={styles.title}>Beer Wall of Fame</Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={12} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={22} color="#f6c65b" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
        ) : donors.length === 0 ? (
          <Text style={styles.empty}>No supporters yet. Be the first! 🍺</Text>
        ) : (() => {
          const recent = donors.filter(isRecent)
          const older  = donors.filter(d => !isRecent(d))
          return (
            <>
              {recent.length > 0 && (
                <>
                  <SectionLabel text="🔥 Last 30 days" />
                  <View style={styles.list}>
                    {recent.map((d, i) => <DonorRow key={i} donor={d} rank={i + 1} />)}
                  </View>
                </>
              )}
              {older.length > 0 && (
                <>
                  <SectionLabel text="Past supporters" />
                  <View style={styles.list}>
                    {older.map((d, i) => <OlderDonorRow key={i} donor={d} />)}
                  </View>
                </>
              )}
            </>
          )
        })()}

        <View style={styles.divider} />

        <SupportFitMeetCard
          title="Join the wall of fame"
          subtitle="Buy a beer and your name scrolls across every screen."
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  shareBtn: {
    width: 36,
    alignItems: 'flex-end',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: 10,
    paddingBottom: 40,
  },
  list: {
    gap: 8,
  },
  donorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  trophy: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,198,91,0.1)',
  },
  rankText: {
    color: '#f6c65b',
    fontSize: 13,
    fontWeight: '800',
  },
  donorInfo: {
    flex: 1,
    gap: 2,
  },
  donorName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  donorLevel: {
    color: 'rgba(246,198,91,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  medalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  empty: {
    color: palette.textDim,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
  },
  sectionLabel: {
    color: 'rgba(246,198,91,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
})
