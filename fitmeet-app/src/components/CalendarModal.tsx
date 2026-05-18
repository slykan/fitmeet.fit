import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'

import { api } from '@/src/lib/api'
import { CATEGORIES } from '@/src/lib/categories'
import { palette, spacing } from '@/src/theme'

interface CalEvent {
  id: number
  title: string
  category: { value: string; label: string }
  schedule: { start_at: string }
}

const CATEGORY_EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.value, c.emoji]))
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isToday(year: number, month: number, day: number) {
  const t = new Date()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

export function CalendarModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    api.get('/events/joined').then(r => setEvents(r.data.data ?? [])).catch(() => {})
  }, [visible])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach(ev => {
      const key = ev.schedule.start_at.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [events])

  const grid = useMemo(() => buildGrid(year, month), [year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  function handleDayPress(day: number) {
    const key = toDateKey(year, month, day)
    const dayEvents = eventsByDate[key]
    if (dayEvents?.length === 1) {
      onClose()
      router.push(`/event/${dayEvents[0].id}` as never)
    } else if (dayEvents?.length > 1) {
      setSelected(selected === key ? null : key)
    } else {
      onClose()
      router.push('/event/create' as never)
    }
  }

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : []

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>My Schedule</Text>
            <Text style={styles.sheetSub}>Tap a day to view or create events</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} hitSlop={12} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={palette.text} />
            </Pressable>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <Pressable onPress={nextMonth} hitSlop={12} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={palette.text} />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map(d => (
              <Text key={d} style={styles.weekDay}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {grid.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />
              const key = toDateKey(year, month, day)
              const dayEvents = eventsByDate[key] ?? []
              const hasEvents = dayEvents.length > 0
              const isSelected = selected === key
              const todayDay = isToday(year, month, day)

              return (
                <Pressable
                  key={i}
                  style={[
                    styles.cell,
                    hasEvents && styles.cellHasEvent,
                    isSelected && styles.cellSelected,
                    todayDay && styles.cellToday,
                  ]}
                  onPress={() => handleDayPress(day)}
                >
                  <Text style={[
                    styles.dayNum,
                    hasEvents && styles.dayNumEvent,
                    todayDay && styles.dayNumToday,
                  ]}>
                    {day}
                  </Text>
                  {hasEvents && (
                    <Text style={styles.catEmoji}>
                      {CATEGORY_EMOJI[dayEvents[0].category.value] ?? '📅'}
                      {dayEvents.length > 1 && <Text style={styles.moreCount}>{`+${dayEvents.length - 1}`}</Text>}
                    </Text>
                  )}
                  {!hasEvents && (
                    <View style={styles.addDot} />
                  )}
                </Pressable>
              )
            })}
          </View>

          {/* Selected day events */}
          {selectedEvents.length > 0 && (
            <View style={styles.selectedList}>
              <Text style={styles.selectedDate}>
                {new Date(`${selected}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {selectedEvents.map(ev => (
                <Pressable
                  key={ev.id}
                  style={styles.eventRow}
                  onPress={() => { onClose(); router.push(`/event/${ev.id}` as never) }}
                >
                  <Text style={styles.eventEmoji}>{CATEGORY_EMOJI[ev.category.value] ?? '📅'}</Text>
                  <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                  <Ionicons name="chevron-forward" size={14} color={palette.textDim} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  )
}

const CELL_SIZE = 44

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#0c0a14',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  sheetSub:   { color: palette.textDim, fontSize: 12, marginTop: 2 },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  navBtn: { padding: 4 },
  monthLabel: { color: palette.text, fontSize: 16, fontWeight: '800' },

  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
  weekDay: {
    flex: 1, textAlign: 'center',
    color: palette.textDim, fontSize: 11, fontWeight: '700',
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.md, gap: 4,
  },
  cell: {
    width: (CELL_SIZE),
    flex: 1,
    minHeight: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    gap: 2,
  },
  cellHasEvent: {
    backgroundColor: 'rgba(108,255,47,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,255,47,0.25)',
  },
  cellSelected: {
    backgroundColor: 'rgba(108,255,47,0.18)',
    borderColor: palette.accent,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dayNum: { color: palette.textDim, fontSize: 13, fontWeight: '600' },
  dayNumEvent: { color: palette.text, fontWeight: '800' },
  dayNumToday: { color: palette.accent, fontWeight: '900' },
  catEmoji: { fontSize: 14, lineHeight: 16 },
  moreCount: { fontSize: 9, color: palette.accent },
  addDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  selectedList: {
    marginTop: 16, marginHorizontal: spacing.md,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  selectedDate: {
    color: palette.accent, fontSize: 12, fontWeight: '800',
    padding: 12, paddingBottom: 8,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  eventEmoji: { fontSize: 18 },
  eventTitle: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' },
})
