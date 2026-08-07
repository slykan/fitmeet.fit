import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { palette, spacing } from '@/src/theme'

const WHAT_YOU_CAN_DO = [
  'Create sports and social events',
  'Join activities near your location',
  'Meet new people with similar interests',
  'Organise local training groups',
  'Stay motivated through community',
]

const WHO_ITS_FOR = [
  'Beginners starting their fitness journey',
  'Active athletes looking for partners',
  'Local sports communities',
  'Travellers searching for activities in new cities',
  'Anyone who prefers moving together instead of alone',
]

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.heading}>About</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>About FitMeet</Text>
          <Text style={styles.h1}>Welcome to FitMeet</Text>
          <Text style={styles.p}>
            Finding people for sports and activities is not always easy. Sometimes friends are busy, local
            groups are inactive, or motivation drops when training alone. That is where FitMeet comes in.
          </Text>
          <Text style={styles.p}>
            FitMeet is a simple platform for connecting people through activities, events, and movement. Users
            can create public or private meetups, join events nearby, and discover others with similar
            interests.
          </Text>
          <Text style={styles.p}>
            The app is made for everyday people — not only professional athletes. Running, cycling, gym
            workouts, hiking, football, basketball, group fitness, casual walks, coffee after training…
            everything can become a meetup.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>How it started</Text>
          <Text style={styles.p}>
            FitMeet started very simply. Literally from a garage, a few friends, and many conversations after
            training sessions.
          </Text>
          <Text style={styles.p}>
            A small group of enthusiasts who enjoy cycling, fitness, running, sports in general… and sometimes
            a beer as a reward after a good workout.
          </Text>
          <Text style={styles.p}>
            Most ideas behind the app come directly from our own experiences. Things we missed, things we
            wanted to organise faster, and things we believed could make local sports communities stronger and
            more active.
          </Text>
          <Text style={styles.p}>We are building FitMeet step by step, together with the community.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>What can you do on FitMeet?</Text>
          <View style={{ gap: 10 }}>
            {WHAT_YOU_CAN_DO.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bulletDot}>
                  <View style={styles.bulletDotInner} />
                </View>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.p, { fontWeight: '700', color: palette.text }]}>
            The goal is simple: make activity more social and easier to start.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Who is FitMeet for?</Text>
          <View style={{ gap: 8 }}>
            {WHO_ITS_FOR.map((item) => (
              <View key={item} style={styles.tagRow}>
                <Text style={styles.tagRowText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.p}>There are no complicated rules or systems. Open the app, find an event, join, and go.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Looking forward</Text>
          <Text style={styles.p}>
            This is only the beginning. We want to continue improving the app, adding new ideas, and expanding
            the community over time.
          </Text>
          <Text style={styles.p}>
            The best part of sport has always been the people around it. That is exactly what we want FitMeet
            to become.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },

  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  card: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    gap: 10,
  },

  eyebrow: { color: palette.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  h1: { color: palette.text, fontSize: 24, fontWeight: '800' },
  h2: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  p:  { color: palette.textMuted, fontSize: 14, lineHeight: 21 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    backgroundColor: 'rgba(108,255,47,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent },
  bulletText: { flex: 1, color: palette.textMuted, fontSize: 14, lineHeight: 20 },

  tagRow: {
    borderRadius: 14, borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.panelRaised, paddingHorizontal: 14, paddingVertical: 10,
  },
  tagRowText: { color: palette.textMuted, fontSize: 13 },
})
