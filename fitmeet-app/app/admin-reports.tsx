import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface Report {
  id: number
  reporter: string | null
  type: string
  reason: string
  details: string | null
  preview: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)

  function load() {
    setLoading(true)
    api.get('/admin/reports')
      .then(({ data }) => setReports(data.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function resolve(report: Report, action: 'remove' | 'dismiss') {
    setActingId(report.id)
    try {
      await api.post(`/admin/reports/${report.id}/resolve`, { action })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch {
      Alert.alert('Error', 'Could not resolve this report. Please try again.')
    } finally {
      setActingId(null)
    }
  }

  function confirmRemove(report: Report) {
    Alert.alert(
      'Remove & eject',
      'This deletes the reported content and suspends the offending account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove & eject', style: 'destructive', onPress: () => resolve(report, 'remove') },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <View>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text style={styles.title}>Reports</Text>
          </View>
        </View>

        {loading && <ActivityIndicator color={palette.accent} style={{ marginTop: 16 }} />}

        {!loading && reports.length === 0 && (
          <Text style={styles.emptyText}>No pending reports. 🎉</Text>
        )}

        {reports.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{r.type}</Text>
              </View>
              <View style={[styles.tag, styles.reasonTag]}>
                <Text style={styles.tagText}>{r.reason}</Text>
              </View>
              <Text style={styles.time}>{timeAgo(r.created_at)}</Text>
            </View>

            <Text style={styles.preview}>{r.preview ?? '(no preview)'}</Text>
            {r.details && <Text style={styles.details}>{r.details}</Text>}
            <Text style={styles.reporter}>Reported by {r.reporter ?? 'unknown'}</Text>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.btn, styles.btnDismiss]}
                onPress={() => resolve(r, 'dismiss')}
                disabled={actingId === r.id}
              >
                <Text style={styles.btnDismissText}>Dismiss</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnRemove]}
                onPress={() => confirmRemove(r)}
                disabled={actingId === r.id}
              >
                {actingId === r.id
                  ? <ActivityIndicator size="small" color="#041109" />
                  : <Text style={styles.btnRemoveText}>Remove & eject</Text>
                }
              </Pressable>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { padding: 4 },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title:   { color: palette.text, fontSize: 20, fontWeight: '800' },

  emptyText: { color: palette.textDim, fontSize: 14 },

  card: {
    backgroundColor: palette.panel, borderRadius: 20,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(57,255,20,0.08)', borderWidth: 1, borderColor: 'rgba(57,255,20,0.2)',
  },
  reasonTag: { backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.25)' },
  tagText: { color: palette.accent, fontSize: 11, fontWeight: '700' },
  time: { color: palette.textDim, fontSize: 12, marginLeft: 'auto' },

  preview: { color: palette.text, fontSize: 14, fontWeight: '600' },
  details: { color: palette.textMuted, fontSize: 13 },
  reporter: { color: palette.textDim, fontSize: 12 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1, borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDismiss: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg },
  btnDismissText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  btnRemove: { backgroundColor: '#f87171' },
  btnRemoveText: { color: '#041109', fontSize: 14, fontWeight: '800' },
})
