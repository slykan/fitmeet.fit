import api from '@/lib/api'

export type ReportableType = 'user' | 'event' | 'comment' | 'listing' | 'message'

const VALID_REASONS = ['spam', 'harassment', 'inappropriate', 'safety', 'other']

export async function reportContent(type: ReportableType, id: number) {
  const reason = window.prompt(
    'Why are you reporting this? (spam / harassment / inappropriate / safety / other)',
    'inappropriate',
  )
  if (!reason) return

  const normalized = VALID_REASONS.includes(reason) ? reason : 'other'
  try {
    await api.post('/reports', { reportable_type: type, reportable_id: id, reason: normalized })
    alert('Report submitted. Our team reviews reports within 24 hours.')
  } catch {
    alert('Could not submit report. Please try again.')
  }
}

export async function blockUser(userId: number): Promise<boolean> {
  if (!confirm('Block this user? They won\'t be able to message you, and their comments, photos and listings will be hidden from you.')) {
    return false
  }
  try {
    await api.post(`/blocks/${userId}`)
    return true
  } catch {
    alert('Could not block this user. Please try again.')
    return false
  }
}

export async function unblockUser(userId: number): Promise<boolean> {
  if (!confirm('Unblock this user? They will be able to message you and see your content again.')) {
    return false
  }
  try {
    await api.delete(`/blocks/${userId}`)
    return true
  } catch {
    alert('Could not unblock this user. Please try again.')
    return false
  }
}
