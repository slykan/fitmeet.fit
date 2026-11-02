import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { palette } from '@/src/theme'

export interface TrainingTotals {
  count: number
  distance_m: number
  duration_s: number
  elevation_gain: number
  calories: number
}

/** One beer (0.33 l lager) ≈ 150 kcal — totals card shows calories burned as beers. */
const KCAL_PER_BEER = 150

function formatDuration(seconds: number): string | null {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function formatDistance(meters: number): string | null {
  if (!meters) return null
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.totalStat}>
      <Ionicons name={icon} size={16} color={palette.accent} />
      <View>
        <Text style={styles.totalStatValue}>{value}</Text>
        <Text style={styles.totalStatLabel}>{label}</Text>
      </View>
    </View>
  )
}

/** Sum of trainings (count, distance, time, elevation, calories, beers); renders nothing when there are none. */
export function TrainingTotalsCard({ totals }: { totals: TrainingTotals | null | undefined }) {
  if (!totals || totals.count <= 0) return null
  const distance = formatDistance(totals.distance_m)
  const duration = formatDuration(totals.duration_s)
  return (
    <View style={styles.totalsCard}>
      <Stat icon="barbell-outline" value={String(totals.count)} label={totals.count === 1 ? 'Training' : 'Trainings'} />
      {distance && <Stat icon="flash-outline" value={distance} label="Distance" />}
      {duration && <Stat icon="time-outline" value={duration} label="Time" />}
      {totals.elevation_gain > 0 && <Stat icon="triangle-outline" value={`${Math.round(totals.elevation_gain)} m`} label="Elevation" />}
      {totals.calories > 0 && <Stat icon="flame-outline" value={`${Math.round(totals.calories)} kcal`} label="Calories" />}
      {totals.calories >= KCAL_PER_BEER && (
        <Stat icon="beer-outline" value={`${Math.round(totals.calories / KCAL_PER_BEER).toLocaleString('hr-HR')} 🍺`} label="Beers burned" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // three equal columns (icon above value + label) → six totals fit in two rows on a phone
  totalsCard: {
    flexDirection: 'row', flexWrap: 'wrap', rowGap: 12,
    backgroundColor: 'rgba(108,255,47,0.07)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)', paddingVertical: 12, paddingHorizontal: 6,
  },
  totalStat: { width: '33.33%', alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  totalStatValue: { color: palette.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  totalStatLabel: { color: palette.textDim, fontSize: 11, marginTop: 1, textAlign: 'center' },
})
