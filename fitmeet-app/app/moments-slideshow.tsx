import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated, Dimensions, Image, Pressable, Share,
  StyleSheet, Text, View,
} from 'react-native'

import { api } from '@/src/lib/api'
import { type MomentCoverPosition } from '@/src/components/MomentCoverImage'
import { palette } from '@/src/theme'

interface Moment {
  id: number
  title: string
  image_url: string
  cover?: MomentCoverPosition | null
  category: string | null
  start_at: string
}

const { width: W, height: H } = Dimensions.get('window')

const CAT_EMOJI: Record<string, string> = {
  running:'🏃', cycling:'🚴', hiking:'🥾', swimming:'🏊', football:'⚽',
  basketball:'🏀', tennis:'🎾', volleyball:'🏐', yoga:'🧘', fitness:'💪',
  martial_arts:'🥊', climbing:'🧗', skiing:'⛷️', skating:'⛸️', surfing:'🏄',
  golf:'⛳', social:'🎉', other:'📅',
}

type AnimType = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'ken-burns'
const ANIM_TYPES: AnimType[] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'ken-burns']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickAnim(): AnimType {
  return ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)]
}

export default function MomentsSlideshowScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useState(false)
  const [anim, setAnim] = useState<AnimType>('zoom-in')

  const fadeAnim = useRef(new Animated.Value(1)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const translateXAnim = useRef(new Animated.Value(0)).current
  const translateYAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current

  const soundRef = useRef<Audio.Sound | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      let all: Moment[] = []
      let p = 1
      let hasMore = true
      while (hasMore && p <= 20) {
        const r = await api.get(`/moments?page=${p}`)
        const data = r.data.data ?? []
        all = [...all, ...data]
        hasMore = !!r.data.has_more && data.length > 0
        p++
      }
      const seen = new Set<string>()
      all = all.filter(m => {
        if (seen.has(m.image_url)) return false
        seen.add(m.image_url)
        return true
      })
      setMoments(shuffle(all))
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const startAnimation = useCallback((animType: AnimType) => {
    scaleAnim.setValue(animType === 'zoom-out' ? 1.15 : 1)
    translateXAnim.setValue(
      animType === 'pan-left' ? W * 0.03 :
      animType === 'pan-right' ? -W * 0.03 :
      animType === 'ken-burns' ? -W * 0.02 : 0
    )
    translateYAnim.setValue(
      animType === 'pan-up' ? H * 0.03 :
      animType === 'ken-burns' ? H * 0.02 : 0
    )

    const toScale = animType === 'zoom-in' ? 1.15 :
                    animType === 'zoom-out' ? 1.0 :
                    animType === 'ken-burns' ? 1.15 : 1.1
    const toX = animType === 'pan-left' ? -W * 0.03 :
                animType === 'pan-right' ? W * 0.03 :
                animType === 'ken-burns' ? W * 0.02 : 0
    const toY = animType === 'pan-up' ? -H * 0.03 :
                animType === 'ken-burns' ? -H * 0.02 : 0

    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: toScale, duration: 4500, useNativeDriver: true }),
      Animated.timing(translateXAnim, { toValue: toX, duration: 4500, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: toY, duration: 4500, useNativeDriver: true }),
    ]).start()
  }, [scaleAnim, translateXAnim, translateYAnim])

  const advanceSlide = useCallback(() => {
    if (moments.length === 0) return

    Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setIndex(prev => {
        let next = prev + 1
        if (next >= moments.length) {
          setMoments(old => {
            const last = old[old.length - 1]
            const shuffled = shuffle(old)
            if (shuffled[0]?.id === last?.id && shuffled.length > 1) {
              [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
            }
            return shuffled
          })
          next = 0
        }
        return next
      })

      const nextAnim = pickAnim()
      setAnim(nextAnim)

      progressAnim.setValue(0)
      Animated.timing(progressAnim, { toValue: 1, duration: 4500, useNativeDriver: false }).start()

      fadeAnim.setValue(0)
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()

      startAnimation(nextAnim)

      timerRef.current = setTimeout(advanceSlide, 4500)
    })
  }, [moments.length, fadeAnim, progressAnim, startAnimation])

  const startPlayback = useCallback(async () => {
    setStarted(true)

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://fitmeet.fit/background-slideshow.mp3' },
        { shouldPlay: true, isLooping: true }
      )
      soundRef.current = sound
    } catch {}

    const firstAnim = pickAnim()
    setAnim(firstAnim)

    progressAnim.setValue(0)
    Animated.timing(progressAnim, { toValue: 1, duration: 4500, useNativeDriver: false }).start()

    fadeAnim.setValue(0)
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()

    startAnimation(firstAnim)

    timerRef.current = setTimeout(() => advanceSlide(), 4500)
  }, [fadeAnim, progressAnim, startAnimation, advanceSlide])

  const toggleMute = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.setIsMutedAsync(!muted)
    }
    setMuted(m => !m)
  }, [muted])

  function handleShare() {
    Share.share({
      message: 'FitMeet — Video Moments from Events! Real people, real events 📸🎶 https://fitmeet.fit/moments/slideshow',
    })
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.loader, { opacity: fadeAnim }]}>
          <Text style={styles.loaderText}>Loading moments…</Text>
        </Animated.View>
      </View>
    )
  }

  if (moments.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No moments yet.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>
    )
  }

  if (!started) {
    return (
      <View style={styles.container}>
        <View style={styles.previewGrid}>
          {moments.slice(0, 9).map((m, i) => (
            <Image key={i} source={{ uri: m.image_url }} style={styles.previewCell} />
          ))}
        </View>
        <Text style={styles.previewTitle}>FitMeet Moments</Text>
        <Text style={styles.previewSub}>Real events, real people</Text>
        <Pressable onPress={startPlayback} style={styles.playBtn}>
          <Ionicons name="play" size={32} color="#000" style={{ marginLeft: 3 }} />
        </Pressable>
        <Text style={styles.tapText}>Tap to play with music</Text>
        <Pressable onPress={() => router.back()} style={styles.previewBack}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
      </View>
    )
  }

  const current = moments[index]
  const focalX = (current.cover?.x ?? 0.5) * 100
  const focalY = (current.cover?.y ?? 0.5) * 100

  return (
    <View style={styles.container}>
      {/* Image */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        opacity: fadeAnim,
        transform: [
          { scale: scaleAnim },
          { translateX: translateXAnim },
          { translateY: translateYAnim },
        ],
      }]}>
        <Image
          source={{ uri: current.image_url }}
          style={[StyleSheet.absoluteFill]}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Gradient */}
      <View style={styles.gradient} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => {
          soundRef.current?.stopAsync()
          if (timerRef.current) clearTimeout(timerRef.current)
          router.back()
        }} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.topRight}>
          <Pressable onPress={toggleMute} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={handleShare} style={styles.shareBtn} hitSlop={12}>
            <Ionicons name="share-social" size={16} color={palette.accent} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom info */}
      <Animated.View style={[styles.bottomInfo, { opacity: fadeAnim }]}>
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>{CAT_EMOJI[current.category ?? ''] ?? '📅'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle} numberOfLines={1}>{current.title}</Text>
            <Text style={styles.infoDate}>
              {new Date(current.start_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }]} />
        </View>
        <Text style={styles.counter}>{index + 1} / {moments.length}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },

  loader: { alignItems: 'center' },
  loaderText: { color: '#fff', fontSize: 14, opacity: 0.5 },

  emptyText: { color: '#fff', fontSize: 14, opacity: 0.5, marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  backBtnText: { color: palette.accent, fontSize: 14, fontWeight: '600' },

  previewGrid: {
    width: 200, height: 200, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', flexWrap: 'wrap', opacity: 0.4,
  },
  previewCell: {
    width: 200 / 3, height: 200 / 3,
  },
  previewTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 24 },
  previewSub: { color: '#fff', fontSize: 13, opacity: 0.5, marginTop: 4 },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
  },
  tapText: { color: '#fff', fontSize: 12, opacity: 0.3, marginTop: 12 },
  previewBack: {
    position: 'absolute', top: 56, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  gradient: {
    ...StyleSheet.absoluteFillObject,
    top: '40%',
    backgroundColor: 'transparent',
    // RN doesn't support CSS gradients, using a semi-transparent overlay
    opacity: 0.8,
    // Simulated via background
  },

  topBar: {
    position: 'absolute', top: 56, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(108,255,47,0.15)',
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)',
  },
  shareBtnText: { color: palette.accent, fontSize: 13, fontWeight: '600' },

  bottomInfo: {
    position: 'absolute', bottom: 50, left: 20, right: 20,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 14,
  },
  infoEmoji: { fontSize: 28 },
  infoTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoDate: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },

  progressTrack: {
    height: 3, borderRadius: 2, marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: palette.accent,
  },
  counter: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 6,
  },
})
