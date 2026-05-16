import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { SupportFitMeetCard } from '@/src/components/SupportFitMeetCard'
import { api } from '@/src/lib/api'

type Donor = { name: string; product_id: string }

const MEDAL_LABEL: Record<string, string> = {
  beer_small: 'Small beer',
  beer_medium: '3 beers',
  beer_large: 'Full crate',
}

function MedalIcons({ productId, size = 10 }: { productId: string; size?: number }) {
  if (productId === 'beer_large') {
    return (
      <View style={styles.medalRow}>
        <Ionicons name="cube" size={size} color="#f6c65b" />
        <Ionicons name="cube" size={size} color="#f6c65b" />
        <Ionicons name="cube" size={size} color="#f6c65b" />
      </View>
    )
  }
  const count = productId === 'beer_medium' ? 3 : 1
  return (
    <View style={styles.medalRow}>
      {Array.from({ length: count }).map((_, i) => (
        <Ionicons key={i} name="beer-outline" size={size} color="#f6c65b" />
      ))}
    </View>
  )
}

function TickerItem({ donor }: { donor: Donor }) {
  return (
    <View style={styles.item}>
      <MedalIcons productId={donor.product_id} />
      <Text style={styles.name}>{donor.name}</Text>
      <Text style={styles.separator}>·</Text>
    </View>
  )
}

function DonorRow({ donor, index }: { donor: Donor; index: number }) {
  return (
    <View style={styles.donorRow}>
      <View style={styles.donorIndex}>
        <Text style={styles.donorIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.donorMedal}>
        <MedalIcons productId={donor.product_id} size={14} />
      </View>
      <View style={styles.donorInfo}>
        <Text style={styles.donorName}>{donor.name}</Text>
        <Text style={styles.donorLevel}>{MEDAL_LABEL[donor.product_id] ?? donor.product_id}</Text>
      </View>
    </View>
  )
}

function SupportersModal({
  visible,
  donors,
  onClose,
  onPurchased,
}: {
  visible: boolean
  donors: Donor[]
  onClose: () => void
  onPurchased: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleRow}>
            <Ionicons name="beer" size={18} color="#f6c65b" />
            <Text style={styles.sheetTitle}>Beer supporters</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.donorList}
          contentContainerStyle={styles.donorListContent}
          showsVerticalScrollIndicator={false}
        >
          <SupportFitMeetCard
            title="Join the wall of fame"
            subtitle="Buy a beer and your name scrolls across every screen."
            onPurchased={() => { onPurchased() }}
          />

          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => { onClose(); router.push('/beer-wall') }}
          >
            <Ionicons name="trophy-outline" size={15} color="#f6c65b" />
            <Text style={styles.seeAllText}>See all supporters</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(246,198,91,0.5)" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

export const BEER_TICKER_HEIGHT = 28
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0

function Label() {
  return (
    <View style={styles.label}>
      <Ionicons name="beer" size={11} color="#f6c65b" />
      <Text style={styles.labelText}>Thanks:</Text>
    </View>
  )
}

export function BeerTickerBanner() {
  const [donors, setDonors] = useState<Donor[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const containerWidth = useRef(0)
  const contentWidth = useRef(0)
  const layoutsReady = useRef({ container: false, content: false })

  function loadDonors() {
    api.get('/beer-donations').then(r => setDonors(r.data)).catch(() => {})
  }

  useEffect(() => {
    loadDonors()
  }, [])

  function tryStart() {
    if (!layoutsReady.current.content) return
    if (!contentWidth.current) return

    animRef.current?.stop()
    translateX.setValue(0)

    // contentWidth is the full doubled content — animate exactly half for seamless loop
    const halfWidth = contentWidth.current / 2
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -halfWidth,
        duration: halfWidth * 18,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    animRef.current.start()
  }

  useEffect(() => {
    return () => { animRef.current?.stop() }
  }, [])

  if (!donors.length) return null

  return (
    <>
      <Pressable
        style={[styles.container, { top: STATUS_BAR_HEIGHT }]}
        onPress={() => setModalVisible(true)}
      >
        <Label />
        <View
          style={styles.inner}
          onLayout={e => {
            containerWidth.current = e.nativeEvent.layout.width
            layoutsReady.current.container = true
            tryStart()
          }}
        >
          <Animated.View
            style={[styles.row, { transform: [{ translateX }] }]}
            onLayout={e => {
              contentWidth.current = e.nativeEvent.layout.width
              layoutsReady.current.content = true
              tryStart()
            }}
          >
            {[...donors, ...donors].map((donor, i) => (
              <TickerItem key={i} donor={donor} />
            ))}
          </Animated.View>
        </View>
        <View style={styles.tapHint}>
          <Ionicons name="chevron-up" size={10} color="rgba(246,198,91,0.55)" />
        </View>
      </Pressable>

      <SupportersModal
        visible={modalVisible}
        donors={donors}
        onClose={() => setModalVisible(false)}
        onPurchased={() => {
          setModalVisible(false)
          loadDonors()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(12,10,5,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(246,198,91,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(246,198,91,0.35)',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(246,198,91,0.25)',
    height: '100%',
    backgroundColor: 'rgba(246,198,91,0.07)',
  },
  labelText: {
    color: '#f6c65b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  inner: {
    flex: 1,
    overflow: 'hidden',
    height: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  medalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  name: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    color: 'rgba(246,198,91,0.5)',
    fontSize: 12,
    marginLeft: 2,
  },
  tapHint: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal / sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0c0a14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(246,198,91,0.25)',
    maxHeight: '80%',
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  donorList: {
    flexGrow: 0,
  },
  donorListContent: {
    padding: 16,
    gap: 8,
  },
  donorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  donorIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(246,198,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donorIndexText: {
    color: '#f6c65b',
    fontSize: 11,
    fontWeight: '800',
  },
  donorMedal: {
    width: 44,
    alignItems: 'center',
  },
  donorInfo: {
    flex: 1,
    gap: 1,
  },
  donorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  donorLevel: {
    color: 'rgba(246,198,91,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(246,198,91,0.2)',
    backgroundColor: 'rgba(246,198,91,0.05)',
  },
  seeAllText: {
    color: '#f6c65b',
    fontSize: 14,
    fontWeight: '700',
  },
})
