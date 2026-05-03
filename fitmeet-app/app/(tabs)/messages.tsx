import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

interface Person {
  id: number
  name: string
  avatar: string | null
}

interface Conversation {
  id: number
  is_group: boolean
  title: string | null
  created_by?: number
  can_manage_members?: boolean
  partner: Person | null
  participants: Person[]
  last_message: { body: string; is_mine: boolean; created_at: string; sender: Person } | null
  unread_count: number
}

interface Msg {
  id: number
  body: string
  image_url?: string | null
  is_mine: boolean
  created_at: string
  sender: Person
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function convTitle(conv: Conversation, meId: number) {
  if (conv.title) return conv.title
  if (!conv.is_group && conv.partner) return conv.partner.name
  const others = conv.participants.filter((p) => p.id !== meId)
  return others.map((p) => p.name).join(', ') || 'Group'
}

function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  if (person.avatar) {
    return <Image source={{ uri: person.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }

  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.letter, { fontSize: size * 0.38 }]}>{person.name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

const av = StyleSheet.create({
  circle: { backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#041109', fontWeight: '800' },
})

function MemberPickerModal({
  visible,
  title,
  subtitle,
  friends,
  selected,
  onClose,
  onToggle,
  onSubmit,
  submitting,
  submitLabel,
}: {
  visible: boolean
  title: string
  subtitle: string
  friends: Person[]
  selected: Person[]
  onClose: () => void
  onToggle: (person: Person) => void
  onSubmit: () => void
  submitting: boolean
  submitLabel: string
}) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!visible) {
      setSearch('')
    }
  }, [visible])

  const filtered = friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.card} onPress={(e) => e.stopPropagation()}>
          <View style={modal.header}>
            <View>
              <Text style={modal.heading}>{title}</Text>
              <Text style={modal.sub}>{subtitle}</Text>
            </View>
            <Pressable style={modal.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={palette.textMuted} />
            </Pressable>
          </View>

          <View style={modal.searchWrap}>
            <Ionicons name="search-outline" size={15} color={palette.textDim} />
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search friends..."
              placeholderTextColor={palette.textDim}
            />
          </View>

          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {selected.map((p) => (
                  <Pressable key={p.id} style={modal.selectedChip} onPress={() => onToggle(p)}>
                    <Text style={modal.selectedChipText}>{p.name}</Text>
                    <Ionicons name="close" size={12} color={palette.accent} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <Text style={modal.emptyText}>No friends available.</Text>
            ) : (
              filtered.map((friend) => {
                const active = selected.some((p) => p.id === friend.id)
                return (
                  <Pressable
                    key={friend.id}
                    style={[modal.friendRow, active && modal.friendRowActive]}
                    onPress={() => onToggle(friend)}
                  >
                    <Avatar person={friend} size={34} />
                    <Text style={[modal.friendName, active && modal.friendNameActive]}>{friend.name}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={palette.accent} />}
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          <Pressable
            style={[modal.sendBtn, (!selected.length || submitting) && modal.sendBtnDisabled]}
            onPress={onSubmit}
            disabled={!selected.length || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#041109" />
            ) : (
              <>
                <Ionicons name="person-add" size={15} color="#041109" />
                <Text style={modal.sendLabel}>{submitLabel}</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ThreadView({
  conversation,
  meId,
  onBack,
}: {
  conversation: Conversation
  meId: number
  onBack: () => void
}) {
  const [conv, setConv] = useState<Conversation>(conversation)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [mutatingMembers, setMutatingMembers] = useState(false)
  const [deletingConversation, setDeletingConversation] = useState(false)
  const [friends, setFriends] = useState<Person[]>([])
  const [selectedAdditions, setSelectedAdditions] = useState<Person[]>([])
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    setConv(conversation)
  }, [conversation])

  useEffect(() => {
    setLoading(true)
    api.get(`/messages/conversations/${conversation.id}`)
      .then(({ data }) => {
        setConv(data.conversation ?? conversation)
        setMessages(data.data ?? data.messages ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversation, conversation.id])

  useEffect(() => {
    if (!showAddMembers || !conv.is_group) return
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }, [showAddMembers, conv.is_group])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      const { data } = await api.post(`/messages/conversations/${conv.id}`, { body: text })
      setMessages((prev) => [...prev, data.data ?? data.message])
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e: unknown) {
      setInput(text)
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Could not send message', message ?? 'Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function pickAndSendImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('image_file', { uri: asset.uri, name: 'photo.jpg', type: 'image/jpeg' } as never)
      const { data } = await api.post(
        `/messages/conversations/${conv.id}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setMessages((prev) => [...prev, data.data ?? data.message])
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      Alert.alert('Could not send image', 'Please try again.')
    } finally {
      setSending(false)
    }
  }

  const title = convTitle(conv, meId)
  const canManageMembers = !!(conv.is_group && (conv.can_manage_members || conv.created_by === meId))
  const memberIds = new Set(conv.participants.map((p) => p.id))
  const addableFriends = friends.filter((f) => !memberIds.has(f.id))

  function toggleAddition(person: Person) {
    setSelectedAdditions((prev) =>
      prev.some((p) => p.id === person.id)
        ? prev.filter((p) => p.id !== person.id)
        : [...prev, person],
    )
  }

  async function handleAddMembers() {
    if (!selectedAdditions.length || mutatingMembers) return
    setMutatingMembers(true)
    try {
      const { data } = await api.post(`/messages/conversations/${conv.id}/participants`, {
        participant_ids: selectedAdditions.map((p) => p.id),
      })
      if (data.conversation) {
        setConv(data.conversation)
      }
      setSelectedAdditions([])
      setShowAddMembers(false)
      setShowMembers(true)
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Could not add members', message ?? 'Please try again.')
    } finally {
      setMutatingMembers(false)
    }
  }

  function promptRemoveMember(person: Person) {
    const isSelf = person.id === meId
    Alert.alert(
      isSelf ? 'Leave conversation?' : 'Remove member?',
      isSelf ? 'Do you want to leave this group?' : `Do you want to remove ${person.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: () => void handleRemoveMember(person),
        },
      ],
    )
  }

  async function handleRemoveMember(person: Person) {
    if (mutatingMembers) return
    setMutatingMembers(true)
    try {
      const { data } = await api.delete(`/messages/conversations/${conv.id}/participants/${person.id}`)
      if (person.id === meId || !data.conversation) {
        onBack()
        return
      }
      setConv(data.conversation)
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Could not update members', message ?? 'Please try again.')
    } finally {
      setMutatingMembers(false)
    }
  }

  function confirmDeleteConversation() {
    const label = conv.is_group ? 'leave this conversation' : 'delete this conversation'
    Alert.alert(
      conv.is_group ? 'Leave conversation?' : 'Delete conversation?',
      `Do you want to ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: conv.is_group ? 'Leave' : 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteConversation(),
        },
      ],
    )
  }

  async function handleDeleteConversation() {
    if (deletingConversation) return
    setDeletingConversation(true)
    try {
      await api.delete(`/messages/conversations/${conv.id}`)
      onBack()
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Could not update conversation', message ?? 'Please try again.')
    } finally {
      setDeletingConversation(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View>
        <View style={th.header}>
          <Pressable style={th.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => conv.is_group && setShowMembers((v) => !v)}>
            <Text style={th.name} numberOfLines={1}>{title}</Text>
            {conv.is_group && (
              <Text style={th.sub}>{conv.participants.length} members - tap to view</Text>
            )}
          </Pressable>
          {conv.is_group && (
            <Pressable onPress={() => setShowMembers((v) => !v)} style={th.chevronBtn}>
              <Ionicons name={showMembers ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
            </Pressable>
          )}
          <Pressable onPress={confirmDeleteConversation} style={th.chevronBtn} disabled={deletingConversation}>
            {deletingConversation ? (
              <ActivityIndicator size="small" color={palette.textMuted} />
            ) : (
              <Ionicons name={conv.is_group ? 'exit-outline' : 'trash-outline'} size={18} color={palette.textMuted} />
            )}
          </Pressable>
        </View>

        {showMembers && conv.is_group && (
          <View style={th.membersWrap}>
            <View style={th.membersHeaderRow}>
              <Text style={th.membersHeaderLabel}>Members</Text>
              {canManageMembers && (
                <Pressable style={th.memberManageBtn} onPress={() => setShowAddMembers(true)}>
                  <Ionicons name="add" size={16} color={palette.accent} />
                  <Text style={th.memberManageText}>Add</Text>
                </Pressable>
              )}
            </View>
            {conv.participants.map((person) => (
              <View key={person.id} style={th.memberRow}>
                <Avatar person={person} size={32} />
                <Text style={th.memberName}>{person.name}{person.id === meId ? ' (you)' : ''}</Text>
                {(canManageMembers || person.id === meId) && (
                  <Pressable style={th.memberRemoveBtn} onPress={() => promptRemoveMember(person)} disabled={mutatingMembers}>
                    <Ionicons
                      name={person.id === meId ? 'exit-outline' : 'remove-circle-outline'}
                      size={16}
                      color="#f87171"
                    />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: spacing.md, gap: 8 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[th.bubble, item.is_mine ? th.bubbleMine : th.bubbleOther]}>
              {!item.is_mine && conv.is_group && (
                <Text style={th.senderName}>{item.sender.name}</Text>
              )}
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={th.msgImage}
                  resizeMode="cover"
                />
              ) : null}
              {item.body ? (
                <Text style={[th.bubbleText, item.is_mine && th.bubbleTextMine]}>{item.body}</Text>
              ) : null}
              <Text style={[th.bubbleTime, item.is_mine && th.bubbleTimeMine]}>{timeAgo(item.created_at)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={th.emptyText}>No messages yet. Say hello!</Text>}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={th.inputRow}>
          <Pressable style={th.imageBtn} onPress={pickAndSendImage} disabled={sending}>
            <Ionicons name="image-outline" size={22} color={palette.textDim} />
          </Pressable>
          <TextInput
            style={th.input}
            value={input}
            onChangeText={setInput}
            placeholder="Write a message..."
            placeholderTextColor={palette.textDim}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[th.sendBtn, (!input.trim() || sending) && th.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#041109" />
            ) : (
              <Ionicons name="send" size={18} color="#041109" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MemberPickerModal
        visible={showAddMembers}
        title="Add Members"
        subtitle="Pick more friends for this group"
        friends={addableFriends}
        selected={selectedAdditions}
        onClose={() => {
          setShowAddMembers(false)
          setSelectedAdditions([])
        }}
        onToggle={toggleAddition}
        onSubmit={handleAddMembers}
        submitting={mutatingMembers}
        submitLabel="Add to Group"
      />
    </View>
  )
}

const th = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  name: { color: palette.text, fontSize: 16, fontWeight: '800' },
  sub: { color: palette.textMuted, fontSize: 12 },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 12, gap: 4 },
  bubbleMine: { backgroundColor: palette.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: palette.panel, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: palette.line },
  bubbleText: { color: palette.text, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#041109' },
  bubbleTime: { color: palette.textDim, fontSize: 10, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(4,17,9,0.6)' },
  senderName: { color: palette.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  emptyText: { color: palette.textMuted, textAlign: 'center', marginTop: 40 },
  chevronBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  membersWrap: { backgroundColor: palette.panelRaised, borderBottomWidth: 1, borderBottomColor: palette.line, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 10 },
  membersHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  membersHeaderLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  memberManageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: `${palette.accent}44`, backgroundColor: `${palette.accent}12` },
  memberManageText: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { color: palette.text, fontSize: 14, fontWeight: '600', flex: 1 },
  memberRemoveBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, alignItems: 'flex-end' },
  input: { flex: 1, maxHeight: 100, borderRadius: 18, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, paddingVertical: 10, color: palette.text, fontSize: 15 },
  sendBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  imageBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  msgImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 4 },
  sendBtnDisabled: { opacity: 0.4 },
})

function NewChatModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: (conv: Conversation) => void
}) {
  const [friends, setFriends] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Person[]>([])
  const [groupTitle, setGroupTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }, [visible])

  function reset() {
    setSearch('')
    setSelected([])
    setGroupTitle('')
    setBody('')
    setError(null)
  }

  function toggle(person: Person) {
    setSelected((prev) =>
      prev.some((p) => p.id === person.id)
        ? prev.filter((p) => p.id !== person.id)
        : [...prev, person],
    )
  }

  const filtered = friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSend() {
    if (selected.length === 0 || !body.trim()) return
    setSending(true)
    setError(null)
    try {
      const { data } = await api.post('/messages/conversations', {
        participant_ids: selected.map((p) => p.id),
        title: selected.length > 1 && groupTitle.trim() ? groupTitle.trim() : undefined,
        body: body.trim(),
      })
      onCreated(data.conversation)
      reset()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.card} onPress={(e) => e.stopPropagation()}>
          <View style={modal.header}>
            <View>
              <Text style={modal.heading}>New Chat</Text>
              <Text style={modal.sub}>Pick one friend or several for a group</Text>
            </View>
            <Pressable style={modal.closeBtn} onPress={() => { reset(); onClose() }}>
              <Ionicons name="close" size={18} color={palette.textMuted} />
            </Pressable>
          </View>

          <Text style={modal.label}>Recipients</Text>

          <View style={modal.searchWrap}>
            <Ionicons name="search-outline" size={15} color={palette.textDim} />
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search friends..."
              placeholderTextColor={palette.textDim}
            />
          </View>

          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {selected.map((p) => (
                  <Pressable key={p.id} style={modal.selectedChip} onPress={() => toggle(p)}>
                    <Text style={modal.selectedChipText}>{p.name}</Text>
                    <Ionicons name="close" size={12} color={palette.accent} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            {friends.length === 0 && <Text style={modal.emptyText}>No friends yet.</Text>}
            {filtered.map((friend) => {
              const active = selected.some((p) => p.id === friend.id)
              return (
                <Pressable key={friend.id} style={[modal.friendRow, active && modal.friendRowActive]} onPress={() => toggle(friend)}>
                  <Avatar person={friend} size={34} />
                  <Text style={[modal.friendName, active && modal.friendNameActive]}>{friend.name}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={palette.accent} />}
                </Pressable>
              )
            })}
          </ScrollView>

          {selected.length > 1 && (
            <TextInput
              style={modal.input}
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="Optional group name"
              placeholderTextColor={palette.textDim}
            />
          )}

          <TextInput
            style={[modal.input, { height: 90, paddingTop: 12, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write a message..."
            placeholderTextColor={palette.textDim}
            multiline
          />

          {error && <Text style={modal.error}>{error}</Text>}

          <Pressable
            style={[modal.sendBtn, (selected.length === 0 || !body.trim() || sending) && modal.sendBtnDisabled]}
            onPress={handleSend}
            disabled={selected.length === 0 || !body.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#041109" />
            ) : (
              <>
                <Ionicons name="send" size={15} color="#041109" />
                <Text style={modal.sendLabel}>{selected.length > 1 ? 'Start Group Chat' : 'Send'}</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: { backgroundColor: palette.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: palette.line, padding: spacing.lg, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heading: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sub: { color: palette.textMuted, fontSize: 13, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  label: { color: palette.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.line, borderRadius: 14, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, color: palette.text, fontSize: 14 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: `${palette.accent}18`, borderWidth: 1, borderColor: `${palette.accent}44` },
  selectedChipText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12 },
  friendRowActive: { backgroundColor: `${palette.accent}10` },
  friendName: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' },
  friendNameActive: { color: palette.accent },
  emptyText: { color: palette.textMuted, fontSize: 13, paddingVertical: 8 },
  input: {
    borderRadius: 14,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    height: 48,
    color: palette.text,
    fontSize: 14,
  },
  error: { color: '#f87171', fontSize: 13 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, backgroundColor: palette.accent },
  sendBtnDisabled: { opacity: 0.4 },
  sendLabel: { color: '#041109', fontSize: 15, fontWeight: '800' },
})

export default function MessagesScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const user = useAuthStore((s) => s.user)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/messages')
      .then(({ data }) => setConversations(data.data ?? data.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(useCallback(() => {
    load()
  }, [load]))

  const filtered = conversations.filter((conv) => {
    const q = search.toLowerCase()
    if (!q) return true
    const title = convTitle(conv, user?.id ?? 0).toLowerCase()
    const last = conv.last_message?.body.toLowerCase() ?? ''
    return title.includes(q) || last.includes(q)
  })

  if (activeConv) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThreadView
          conversation={activeConv}
          meId={user?.id ?? 0}
          onBack={() => {
            setActiveConv(null)
            load()
          }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <Pressable style={styles.newBtn} onPress={() => setShowCompose(true)}>
            <Ionicons name="add" size={22} color="#041109" />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={palette.textDim} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations..."
            placeholderTextColor={palette.textDim}
          />
        </View>

        {loading && <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color={palette.textDim} />
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptyHint}>Tap + to start a new chat.</Text>
          </View>
        )}

        {!loading && filtered.map((conv) => {
          const title = convTitle(conv, user?.id ?? 0)
          const last = conv.last_message
          return (
            <View key={conv.id} style={styles.convRowWrap}>
              <Pressable style={[styles.convRow, { flex: 1 }]} onPress={() => setActiveConv(conv)}>
                {conv.is_group ? (
                  <View style={[styles.avatar, { backgroundColor: `${palette.accent}18`, borderWidth: 1, borderColor: `${palette.accent}44` }]}>
                    <Ionicons name="people" size={20} color={palette.accent} />
                  </View>
                ) : conv.partner ? (
                  <View style={styles.avatar}>
                    <Avatar person={conv.partner} size={48} />
                  </View>
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>{title.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.convMeta}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName} numberOfLines={1}>{title}</Text>
                    {last && <Text style={styles.convTime}>{timeAgo(last.created_at)}</Text>}
                  </View>
                  {last && (
                    <Text style={styles.convPreview} numberOfLines={1}>
                      {last.is_mine ? 'You: ' : ''}{last.body}
                    </Text>
                  )}
                </View>

                {conv.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{conv.unread_count}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={styles.convDeleteBtn}
                onPress={async () => {
                  Alert.alert(
                    conv.is_group ? 'Leave conversation' : 'Delete conversation',
                    conv.is_group ? 'Leave this group chat?' : 'Delete this conversation?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: conv.is_group ? 'Leave' : 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await api.delete(`/messages/conversations/${conv.id}`)
                            setConversations(prev => prev.filter(c => c.id !== conv.id))
                          } catch {}
                        },
                      },
                    ]
                  )
                }}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,100,100,0.6)" />
              </Pressable>
            </View>
          )
        })}
      </ScrollView>

      <NewChatModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onCreated={(conv) => {
          setShowCompose(false)
          setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
          setActiveConv(conv)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.text, fontSize: 28, fontWeight: '900' },
  newBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, height: 48 },
  searchInput: { flex: 1, color: palette.text, fontSize: 14 },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  emptyText: { color: palette.text, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: palette.textMuted, fontSize: 13 },
  convRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line },
  convDeleteBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,100,100,0.08)', borderWidth: 1, borderColor: 'rgba(255,100,100,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: palette.text, fontSize: 20, fontWeight: '800' },
  convMeta: { flex: 1, gap: 4 },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '800' },
  convTime: { color: palette.textDim, fontSize: 11, fontWeight: '600' },
  convPreview: { color: palette.textMuted, fontSize: 13 },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  unreadText: { color: '#041109', fontSize: 12, fontWeight: '800' },
})
