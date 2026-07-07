import { Ionicons } from '@expo/vector-icons'
import { File, Paths } from 'expo-file-system/next'
import * as MediaLibrary from 'expo-media-library'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, Pressable,
  ScrollView, Share, StyleSheet, Text, View,
} from 'react-native'
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { CATEGORIES } from '@/src/lib/categories'
import { reportContent } from '@/src/lib/moderation'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

interface Listing {
  id: number
  type: 'sell' | 'buy'
  title: string
  description: string | null
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new' | null
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string; avatar: string | null }
  is_mine: boolean
  views_count: number
  saves_count: number
  is_saved: boolean
}

const CAT_EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.value, c.emoji]))
const CONDITION_LABEL: Record<string, string> = { new: 'New', used: 'Used', like_new: 'Like new' }
const CONDITION_COLOR: Record<string, string> = {
  new:      '#4ade80',
  like_new: '#6cff2f',
  used:     '#94a3b8',
}

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore(s => s.user)

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/market/${id}`)
      .then(({ data }) => setListing(data.data))
      .catch(() => router.back())
      .finally(() => setLoading(false))
  }, [id])

  async function handleToggleSave() {
    if (!listing || saving) return
    setSaving(true)
    try {
      const { data } = await api.post(`/market/${listing.id}/save`)
      setListing(l => l ? {
        ...l,
        is_saved: data.is_saved,
        saves_count: l.saves_count + (data.is_saved ? 1 : -1),
      } : l)
    } catch {}
    finally { setSaving(false) }
  }

  async function handleMessage() {
    if (!listing) return
    setActing(true)
    try {
      await api.post('/messages/conversations', {
        participant_ids: [listing.seller.id],
        body: `Hi, I'm interested in your listing: ${listing.title}`,
      })
      router.push('/(tabs)/messages' as never)
    } catch {
      Alert.alert('Error', 'Could not open conversation.')
    } finally {
      setActing(false)
    }
  }

  async function handleShare() {
    if (!listing) return
    const url = `https://fitmeet.fit/market/share/?id=${encodeURIComponent(String(listing.id))}`
    const priceLabel = listing.price > 0
      ? `${listing.type === 'buy' ? 'up to ' : ''}${listing.price.toFixed(0)} ${listing.currency}`
      : listing.type === 'buy' ? 'Wanted on FitMeet' : 'For sale on FitMeet'
    const message = [listing.title, priceLabel, listing.description, url].filter(Boolean).join('\n\n')

    await Share.share({
      title: listing.title,
      message,
      url,
    }).catch(() => {})
  }

  async function handleDownloadImage() {
    if (!listing || downloading) return
    const url = listing.images[activeImg]
    if (!url) return
    setDownloading(true)
    try {
      const filename = `fitmeet_${Date.now()}.jpg`
      const dest = new File(Paths.cache, filename)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      dest.write(base64, { encoding: 'base64' })
      await MediaLibrary.saveToLibraryAsync(dest.uri)
      Alert.alert('Saved', 'Image saved to your gallery.')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save image.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleToggleSold() {
    if (!listing) return
    const isSold = listing.status === 'sold'
    Alert.alert(
      isSold ? 'Mark as active' : 'Mark as sold',
      isSold ? 'Re-activate this listing?' : 'Mark this listing as sold?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSold ? 'Activate' : 'Mark sold',
          style: isSold ? 'default' : 'destructive',
          onPress: async () => {
            setActing(true)
            try {
              const { data } = await api.post(`/market/${listing.id}/sold`)
              setListing(l => l ? { ...l, ...data.data, status: data.data.status } : l)
            } catch {
              Alert.alert('Error', 'Could not update listing.')
            } finally {
              setActing(false)
            }
          },
        },
      ],
    )
  }

  async function handleDelete() {
    if (!listing) return
    Alert.alert('Delete listing', 'Delete this listing permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setActing(true)
          try {
            await api.delete(`/market/${listing.id}`)
            router.back()
          } catch {
            Alert.alert('Error', 'Could not delete listing.')
            setActing(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!listing) return null

  const emoji   = CAT_EMOJI[listing.category.value] ?? '🏷️'
  const sold    = listing.status === 'sold'
  const canEdit = listing.is_mine || user?.is_admin

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Lightbox */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <View style={styles.lightboxBg}>
          <View style={styles.lightboxTopBar}>
            <Pressable
              style={styles.lightboxAction}
              onPress={handleDownloadImage}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#fff" />
              )}
            </Pressable>
            <Pressable style={styles.lightboxAction} onPress={() => setLightbox(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <ReactNativeZoomableView
            key={activeImg}
            maxZoom={5}
            minZoom={1}
            initialZoom={1}
            bindToBorders
            style={styles.lightboxZoomContainer}
          >
            <Image
              source={{ uri: listing.images[activeImg] }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 }}
              resizeMode="contain"
            />
          </ReactNativeZoomableView>
          {listing.images.length > 1 && (
            <View style={styles.lightboxThumbs}>
              {listing.images.map((src, i) => (
                <Pressable key={i} onPress={() => setActiveImg(i)}>
                  <Image
                    source={{ uri: src }}
                    style={[styles.lightboxThumb, i === activeImg && styles.lightboxThumbActive]}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={palette.accent} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {/* Images */}
        {listing.images.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => setLightbox(true)} style={styles.mainImage}>
              <Image source={{ uri: listing.images[activeImg] }} style={styles.mainImage} resizeMode="cover" />
              {sold && (
                <View style={styles.soldOverlay}>
                  <Text style={styles.soldText}>SOLD</Text>
                </View>
              )}
              <View style={styles.zoomHint}>
                <Ionicons name="expand-outline" size={14} color="#fff" />
              </View>
            </Pressable>
            {listing.images.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
                {listing.images.map((src, i) => (
                  <Pressable key={i} onPress={() => setActiveImg(i)}>
                    <Image
                      source={{ uri: src }}
                      style={[styles.thumb, activeImg === i && styles.thumbActive]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={styles.noImageBox}>
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </View>
        )}

        {/* Info card */}
        <View style={styles.card}>

          {/* Title + price */}
          <View style={{ gap: 6 }}>
            <Text style={styles.listingTitle}>{listing.title}</Text>
            {listing.price > 0 && (
              <Text style={styles.price}>
                {listing.price.toFixed(0)}{' '}
                <Text style={styles.currency}>{listing.currency}</Text>
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{emoji} {listing.category.label}</Text>
              </View>
              {listing.condition && (
                <View style={[styles.condBadge, { borderColor: CONDITION_COLOR[listing.condition] + '55' }]}>
                  <Text style={[styles.condBadgeText, { color: CONDITION_COLOR[listing.condition] }]}>
                    {CONDITION_LABEL[listing.condition]}
                  </Text>
                </View>
              )}
              {listing.type === 'buy' && (
                <View style={styles.wantedBadge}>
                  <Text style={styles.wantedBadgeText}>WANTED</Text>
                </View>
              )}
              {sold && (
                <View style={styles.soldBadge}>
                  <Text style={styles.soldBadgeText}>Sold</Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          {/* Location */}
          {(listing.location.city || listing.location.country) && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={palette.textDim} />
              <Text style={styles.locationText}>
                {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {/* Views + saves */}
          {((listing.views_count ?? 0) > 0 || (listing.saves_count ?? 0) > 0) && (
            <View style={styles.statsRow}>
              {(listing.views_count ?? 0) > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="eye-outline" size={13} color={palette.textDim} />
                  <Text style={styles.statText}>{listing.views_count}</Text>
                </View>
              )}
              {(listing.saves_count ?? 0) > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="heart-outline" size={13} color={palette.textDim} />
                  <Text style={styles.statText}>{listing.saves_count} saved</Text>
                </View>
              )}
            </View>
          )}

          {/* Seller */}
          <View style={styles.sellerRow}>
            <View style={styles.sellerAvatar}>
              {listing.seller.avatar ? (
                <Image source={{ uri: listing.seller.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} resizeMode="cover" />
              ) : (
                <Text style={styles.sellerAvatarText}>{listing.seller.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerLabel}>Seller</Text>
              <Text style={styles.sellerName}>{listing.seller.name}</Text>
            </View>
            {!listing.is_mine && (
              <Pressable onPress={() => reportContent('listing', listing.id)} hitSlop={10}>
                <Ionicons name="flag-outline" size={18} color={palette.textDim} />
              </Pressable>
            )}
          </View>

          {/* Actions — row 1: secondary buttons */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.btnShare} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={15} color={palette.accent} />
              <Text style={styles.btnShareText}>Share</Text>
            </Pressable>
            {!listing.is_mine && (
              <Pressable
                style={[styles.btnShare, listing.is_saved && styles.btnSaveActive]}
                onPress={handleToggleSave}
                disabled={saving}
              >
                <Ionicons
                  name={listing.is_saved ? 'heart' : 'heart-outline'}
                  size={15}
                  color={listing.is_saved ? '#f87171' : palette.accent}
                />
                <Text style={[styles.btnShareText, listing.is_saved && { color: '#f87171' }]}>
                  {listing.is_saved ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
            )}
            {listing.is_mine && !sold && (
              <Pressable
                style={[styles.btnShare, { flex: 1 }]}
                onPress={() => router.push(`/market/create?id=${listing.id}` as never)}
              >
                <Ionicons name="pencil-outline" size={15} color={palette.accent} />
                <Text style={styles.btnShareText}>Edit</Text>
              </Pressable>
            )}
            {listing.is_mine && sold && (
              <Pressable
                style={[styles.btnShare, { flex: 1, borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.08)' }]}
                onPress={handleToggleSold}
                disabled={acting}
              >
                <Ionicons name="refresh-outline" size={15} color="#60a5fa" />
                <Text style={[styles.btnShareText, { color: '#60a5fa' }]}>Mark active</Text>
              </Pressable>
            )}
            {canEdit && (
              <Pressable style={styles.btnDelete} onPress={handleDelete} disabled={acting}>
                <Ionicons name="trash-outline" size={15} color="#f87171" />
              </Pressable>
            )}
          </View>

          {/* Actions — row 2: primary action */}
          {!listing.is_mine && !sold && (
            <Pressable style={styles.btnPrimaryFull} onPress={handleMessage} disabled={acting}>
              <Ionicons name="chatbubble-outline" size={16} color="#031109" />
              <Text style={styles.btnPrimaryText}>Send msg</Text>
            </Pressable>
          )}
          {listing.is_mine && !sold && (
            <Pressable style={styles.btnSoldFull} onPress={handleToggleSold} disabled={acting}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#4ade80" />
              <Text style={styles.btnSoldText}>Mark sold</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content:  { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: palette.accent, fontWeight: '700', fontSize: 14 },

  mainImage: { width: '100%', height: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: palette.panel },
  soldOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  soldText: { color: '#f87171', fontWeight: '900', fontSize: 28, borderWidth: 2, borderColor: '#f87171', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 12 },
  zoomHint: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 6 },
  thumb:       { width: 64, height: 64, borderRadius: 14, borderWidth: 2, borderColor: palette.line },
  thumbActive: { borderColor: palette.accent },

  noImageBox: { height: 180, borderRadius: 20, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 14 },

  listingTitle: { color: palette.text, fontSize: 22, fontWeight: '900', lineHeight: 28 },

  catBadge:     { backgroundColor: 'rgba(108,255,47,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)' },
  catBadgeText: { color: palette.accent, fontSize: 11, fontWeight: '700' },
  condBadge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  condBadgeText:{ fontSize: 11, fontWeight: '700' },
  wantedBadge:  { backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  wantedBadgeText: { color: '#60a5fa', fontSize: 10, fontWeight: '900' },
  soldBadge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)' },
  soldBadgeText:{ color: '#f87171', fontSize: 11, fontWeight: '700' },

  price:    { color: palette.accent, fontSize: 26, fontWeight: '900', flexShrink: 0 },
  currency: { fontSize: 16, fontWeight: '700' },

  description: { color: palette.textMuted, fontSize: 14, lineHeight: 22 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText:{ color: palette.textDim, fontSize: 13 },

  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: palette.line },
  sellerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sellerAvatarText: { color: '#031109', fontWeight: '900', fontSize: 16 },
  sellerLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
  sellerName:  { color: palette.text, fontWeight: '700', fontSize: 14 },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnShare:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(108,255,47,0.35)', backgroundColor: 'rgba(108,255,47,0.08)' },
  btnShareText:   { color: palette.accent, fontWeight: '800', fontSize: 13 },
  btnPrimary:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 12 },
  btnPrimaryFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 13 },
  btnPrimaryText: { color: '#031109', fontWeight: '800', fontSize: 14 },
  btnOutline:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised },
  btnOutlineText: { color: palette.text, fontWeight: '700', fontSize: 13 },
  btnSold:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  btnSoldFull:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 13, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  btnSoldText:    { color: '#4ade80', fontWeight: '800', fontSize: 13 },
  btnDelete:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },

  lightboxBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  lightboxTopBar: { position: 'absolute', top: 50, right: 20, flexDirection: 'row', gap: 10, zIndex: 10 },
  lightboxAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  lightboxZoomContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lightboxThumbs: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  lightboxThumb:  { width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  lightboxThumbActive: { borderColor: palette.accent },

  statsRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:  { color: palette.textDim, fontSize: 12 },

  btnSaveActive: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)' },
})
