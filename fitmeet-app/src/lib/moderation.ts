import { Alert } from 'react-native'

import { api } from '@/src/lib/api'

export type ReportableType = 'user' | 'event' | 'comment' | 'listing' | 'message'

const REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'safety', label: 'Safety concern' },
  { key: 'other', label: 'Other' },
]

export function reportContent(type: ReportableType, id: number) {
  Alert.alert(
    'Report',
    'Why are you reporting this?',
    [
      ...REASONS.map((reason) => ({
        text: reason.label,
        onPress: () => {
          api.post('/reports', { reportable_type: type, reportable_id: id, reason: reason.key })
            .then(() => Alert.alert('Report submitted', 'Our team reviews reports within 24 hours.'))
            .catch(() => Alert.alert('Error', 'Could not submit report. Please try again.'))
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ],
  )
}

export function blockUser(userId: number, onDone?: () => void) {
  Alert.alert(
    'Block user',
    'They won\'t be able to message you, and their comments, photos and listings will be hidden from you.',
    [
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          api.post(`/blocks/${userId}`)
            .then(() => onDone?.())
            .catch(() => Alert.alert('Error', 'Could not block this user. Please try again.'))
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  )
}

export function unblockUser(userId: number, onDone?: () => void) {
  Alert.alert(
    'Unblock user',
    'They will be able to message you and see your content again.',
    [
      {
        text: 'Unblock',
        onPress: () => {
          api.delete(`/blocks/${userId}`)
            .then(() => onDone?.())
            .catch(() => Alert.alert('Error', 'Could not unblock this user. Please try again.'))
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  )
}

export function presentUserModerationMenu(opts: {
  userId: number
  userName: string
  isBlocked?: boolean
  onBlockedChange?: () => void
}) {
  const { userId, userName, isBlocked, onBlockedChange } = opts

  Alert.alert(
    userName,
    undefined,
    [
      { text: 'Report user', onPress: () => reportContent('user', userId) },
      isBlocked
        ? { text: 'Unblock user', onPress: () => unblockUser(userId, onBlockedChange) }
        : { text: 'Block user', style: 'destructive', onPress: () => blockUser(userId, onBlockedChange) },
      { text: 'Cancel', style: 'cancel' },
    ],
  )
}
