import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SupportFitMeetCard } from '@/src/components/SupportFitMeetCard'
import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface Entry { id: number; name: string; avatar: string | null; count: number }
interface Data {
  beer: Entry[]; consistency: Entry[]; creator: Entry[]
  connector: Entry[]; legend: Entry[]; social: Entry[]; late: Entry[]
  marketplace: Entry[]
}

const SECTIONS: {
  key: keyof Data
  emoji: string
  title: string
  desc: string
  unit: string
}[] = [
  { key: 'beer',        emoji: '🍺', title: 'Beer Sponsor',      desc: 'Bought the most drinks',        unit: 'pts'      },
  { key: 'consistency', emoji: '🔥', title: 'Consistency Beast',  desc: 'Joined the most events',        unit: 'events'   },
  { key: 'creator',     emoji: '👑', title: 'Event Creator',      desc: 'Organized the most events',     unit: 'events'   },
  { key: 'connector',   emoji: '🤝', title: 'Connector',          desc: 'Invited the most people',       unit: 'invites'  },
  { key: 'legend',      emoji: '📍', title: 'Local Legend',       desc: 'Check-in king',                 unit: 'check-ins'},
  { key: 'social',      emoji: '💬', title: 'Social Animal',      desc: 'Most comments',                 unit: 'comments' },
  { key: 'late',        emoji: '⏰', title: 'Always Late',         desc: 'Joined but never checked in 😄', unit: 'skips'   },
  { key: 'marketplace', emoji: '🛒', title: 'Top Seller',          desc: 'Garage sale champion 💪',         unit: 'ads'     },
]

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={styles.trophy}>🥇</Text>
  if (rank === 2) return <Text style={styles.trophy}>🥈</Text>
  if (rank === 3) return <Text style={styles.trophy}>🥉</Text>
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankNum}>{rank}</Text>
    </View>
  )
}

function EntryRow({ entry, rank, unit }: { entry: Entry; rank: number; unit: string }) {
  return (
    <View style={styles.row}>
      <RankIcon rank={rank} />
      {entry.avatar
        ? <Image source={{ uri: entry.avatar }} style={styles.avatar} />
        : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{entry.name.charAt(0).toUpperCase()}</Text>
          </View>
        )
      }
      <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{entry.count} {unit}</Text>
      </View>
    </View>
  )
}

function Section({ section, data, onBuyBeer }: { section: typeof SECTIONS[0]; data: Entry[]; onBuyBeer?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={styles.sectionEmoji}>{section.emoji}</Text>
        <View style={styles.sectionMeta}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionDesc}>{section.desc}</Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={palette.textDim}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.sectionBody}>
          {data.length === 0 ? (
            <Text style={styles.empty}>No data yet.</Text>
          ) : (
            data.map((entry, i) => (
              <EntryRow key={entry.id} entry={entry} rank={i + 1} unit={section.unit} />
            ))
          )}
          {onBuyBeer && (
            <Pressable style={styles.buyBeerBtn} onPress={onBuyBeer}>
              <Text style={styles.buyBeerText}>🍺 Buy a beer</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

export default function RanksScreen() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBeer, setShowBeer] = useState(false)

  useEffect(() => {
    api.get('/leaderboard')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleShare() {
    Share.share({
      message: 'Check out the FitMeet Community Badges — who\'s on top? 🏆 https://fitmeet.fit/ranks',
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <Text style={styles.headerTitle}>🏆 Community Badges</Text>
          <Text style={styles.headerSub}>Last 30 days</Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-social-outline" size={20} color={palette.accent} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {SECTIONS.map(s => (
            <Section
              key={s.key}
              section={s}
              data={data?.[s.key] ?? []}
              onBuyBeer={s.key === 'beer' ? () => setShowBeer(true) : undefined}
            />
          ))}
        </ScrollView>
      )}
      <Modal visible={showBeer} transparent animationType="fade" onRequestClose={() => setShowBeer(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBeer(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="beer-outline" size={22} color="#f6c65b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Buy me a beer 🍺</Text>
                <Text style={styles.modalSub}>Support FitMeet and get on the leaderboard!</Text>
              </View>
              <Pressable hitSlop={12} onPress={() => setShowBeer(false)}>
                <Ionicons name="close" size={20} color={palette.textDim} />
              </Pressable>
            </View>
            <SupportFitMeetCard
              title="Buy me a beer"
              subtitle="Every beer helps keep this app running and improving."
              onPurchased={() => setShowBeer(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: palette.text, fontSize: 20, fontWeight: '900' },
  headerSub:   { color: palette.textDim, fontSize: 12, fontWeight: '600' },
  scroll: { padding: spacing.md, gap: 10, paddingBottom: 40 },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  sectionEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  sectionMeta: { flex: 1, gap: 1 },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  sectionDesc:  { color: palette.textDim, fontSize: 12 },

  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 6,
    gap: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  trophy: { fontSize: 20, width: 28, textAlign: 'center' },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rankNum: { color: palette.textDim, fontSize: 12, fontWeight: '800' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(108,255,47,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  entryName: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(108,255,47,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,255,47,0.2)',
  },
  countText: { color: palette.accent, fontSize: 11, fontWeight: '800' },
  empty: { color: palette.textDim, fontSize: 13, textAlign: 'center', padding: 16 },

  buyBeerBtn: {
    margin: 12, marginTop: 8, paddingVertical: 12, borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(246,198,91,0.1)',
    borderWidth: 1, borderColor: 'rgba(246,198,91,0.3)',
  },
  buyBeerText: { color: '#f6c65b', fontSize: 14, fontWeight: '800' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.panel,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md, paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  modalIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(246,198,91,0.12)',
    borderWidth: 1, borderColor: 'rgba(246,198,91,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  modalSub:   { color: palette.textDim, fontSize: 12, marginTop: 2 },
})
