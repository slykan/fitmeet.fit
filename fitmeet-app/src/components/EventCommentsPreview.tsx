import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { api } from '@/src/lib/api'
import { palette } from '@/src/theme'

type CommentUser = {
  id: number | null
  name: string | null
  avatar: string | null
}

type EventComment = {
  id: number
  body: string
  created_at: string
  user: CommentUser
}

type Props = {
  eventId: number
  count: number
}

export function EventCommentsPreview({ eventId, count }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<EventComment[]>([])
  const [locked, setLocked] = useState(false)

  if (count <= 0) return null

  async function toggleExpanded() {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)

    if (comments.length > 0 || loading || locked) {
      return
    }

    setLoading(true)
    try {
      const { data } = await api.get(`/events/${eventId}/comments`)
      setComments((data.data ?? []) as EventComment[])
      setLocked(false)
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setLocked(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const previewComments = comments.slice(-2)

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={(event) => {
          event.stopPropagation()
          toggleExpanded().catch(() => {})
        }}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.accent} />
          <Text style={styles.headerText}>Comments ({count})</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={palette.textDim}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : locked ? (
            <Text style={styles.hint}>Join this event to preview comments.</Text>
          ) : previewComments.length === 0 ? (
            <Text style={styles.hint}>Comments are there, but preview is still waking up.</Text>
          ) : (
            <>
              {previewComments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Text style={styles.author}>{comment.user.name ?? 'Member'}</Text>
                  <Text style={styles.bodyText} numberOfLines={2}>{comment.body}</Text>
                </View>
              ))}

              <Pressable
                onPress={(event) => {
                  event.stopPropagation()
                  router.push(`/event/${eventId}?wall=1` as never)
                }}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>View more</Text>
                <Ionicons name="arrow-forward" size={13} color={palette.accent} />
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  header: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  body: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 2,
  },
  hint: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  commentRow: {
    gap: 3,
    paddingTop: 2,
  },
  author: { color: palette.text, fontSize: 12, fontWeight: '700' },
  bodyText: { color: palette.textDim, fontSize: 12, lineHeight: 17 },
  moreBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  moreText: { color: palette.accent, fontSize: 12, fontWeight: '800' },
})
