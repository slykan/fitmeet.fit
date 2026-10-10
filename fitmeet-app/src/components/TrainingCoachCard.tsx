import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { api } from '@/src/lib/api'
import { palette } from '@/src/theme'

interface CoachNote {
  headline: string
  summary: string
  tip: string | null
  questions: string[]
  answers: { question: string; answer: string }[]
}

interface CoachPayload {
  available: boolean
  note: CoachNote | null
  quota: { analyses_left: number; questions_left: number }
}

// The coach answers in the phone's language (e.g. "hr-HR" → Croatian).
function phoneLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en'
  } catch {
    return 'en'
  }
}

/** "What does the coach say?" — AI analysis of the user's own training (owner only). */
export function TrainingCoachCard({ trainingId }: { trainingId: number }) {
  const [data, setData] = useState<CoachPayload | null>(null)
  const [busy, setBusy] = useState<'analyze' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')

  useEffect(() => {
    api.get(`/trainings/${trainingId}/coach`).then(({ data }) => setData(data)).catch(() => {})
  }, [trainingId])

  async function run(kind: 'analyze' | 'ask', q?: string) {
    setBusy(kind)
    setError(null)
    try {
      const { data } = kind === 'analyze'
        ? await api.post(`/trainings/${trainingId}/coach`, { language: phoneLanguage() })
        : await api.post(`/trainings/${trainingId}/coach/ask`, { question: q, language: phoneLanguage() })
      setData(data)
      if (kind === 'ask') setQuestion('')
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'The coach is not reachable right now.')
    } finally {
      setBusy(null)
    }
  }

  if (!data || !data.available) return null
  const note = data.note
  const asked = new Set(note?.answers.map(a => a.question.toLowerCase()) ?? [])
  const openQuestions = note?.questions.filter(q => !asked.has(q.toLowerCase())) ?? []

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.badge}><Ionicons name="sparkles" size={14} color="#041109" /></View>
        <Text style={styles.title}>Coach</Text>
      </View>

      {!note ? (
        <>
          <Text style={styles.muted}>Get a short analysis of this training — compared with your recent ones — and a tip for the next one.</Text>
          <Pressable style={[styles.primaryBtn, busy && styles.disabled]} onPress={() => run('analyze')} disabled={!!busy || data.quota.analyses_left <= 0}>
            {busy === 'analyze'
              ? <ActivityIndicator color="#041109" />
              : <Text style={styles.primaryText}>{data.quota.analyses_left > 0 ? 'What does the coach say?' : 'No analyses left this month'}</Text>}
          </Pressable>
          <Text style={styles.small}>{data.quota.analyses_left} analyses left this month</Text>
        </>
      ) : (
        <>
          <Text style={styles.headline}>{note.headline}</Text>
          <Text style={styles.body}>{note.summary}</Text>
          {note.tip ? (
            <View style={styles.tip}>
              <Ionicons name="bulb-outline" size={15} color={palette.accent} />
              <Text style={styles.tipText}>{note.tip}</Text>
            </View>
          ) : null}

          {note.answers.map(a => (
            <View key={a.question} style={styles.qa}>
              <Text style={styles.q}>{a.question}</Text>
              <Text style={styles.body}>{a.answer}</Text>
            </View>
          ))}

          {openQuestions.length > 0 && (
            <View style={styles.chips}>
              {openQuestions.map(q => (
                <Pressable key={q} style={[styles.chip, busy && styles.disabled]} onPress={() => run('ask', q)} disabled={!!busy || data.quota.questions_left <= 0}>
                  <Text style={styles.chipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.askRow}>
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask the coach about this training…"
              placeholderTextColor={palette.textDim}
              maxLength={300}
              editable={!busy && data.quota.questions_left > 0}
            />
            <Pressable style={[styles.sendBtn, (!question.trim() || busy) && styles.disabled]} onPress={() => run('ask', question.trim())} disabled={!question.trim() || !!busy}>
              {busy === 'ask' ? <ActivityIndicator color="#041109" size="small" /> : <Ionicons name="arrow-up" size={18} color="#041109" />}
            </Pressable>
          </View>
          <Text style={styles.small}>{data.quota.questions_left} questions left this month · Not medical advice</Text>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 14, borderRadius: 16, gap: 10,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 24, height: 24, borderRadius: 8, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.text, fontSize: 15, fontWeight: '800' },
  muted: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  headline: { color: palette.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  body: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
  tip: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(108,255,47,0.08)' },
  tipText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 19 },
  qa: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.line },
  q: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  chips: { gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised },
  chipText: { color: palette.text, fontSize: 13 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, height: 42, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 14,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { height: 44, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  small: { color: palette.textDim, fontSize: 11 },
  error: { color: '#ff6b6b', fontSize: 12 },
})
