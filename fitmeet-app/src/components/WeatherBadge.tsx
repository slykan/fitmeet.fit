import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { palette } from '@/src/theme'
import { EventWeather, fetchEventWeather, weatherIconName } from '@/src/lib/weather'

type Props = {
  lat: number
  lng: number
  isoDate: string
  hour: number
  weather?: EventWeather | null
  indent?: number
  iconSize?: number
}

export function WeatherBadge({ lat, lng, isoDate, hour, weather: weatherProp, indent = 0, iconSize = 16 }: Props) {
  const [weather, setWeather] = useState<EventWeather | null>(null)

  useEffect(() => {
    if (weatherProp) {
      setWeather(weatherProp)
      return
    }

    fetchEventWeather(lat, lng, isoDate, hour).then(setWeather)
  }, [lat, lng, isoDate, hour, weatherProp])

  const resolvedWeather = weatherProp ?? weather
  if (!resolvedWeather) return null

  return (
    <View style={[styles.row, indent ? { marginLeft: indent } : null]}>
      <Ionicons name={weatherIconName(resolvedWeather.code) as never} size={iconSize} color={palette.textMuted} />
      <Text style={styles.temp}>
        {resolvedWeather.tempMin}°/{resolvedWeather.tempMax}°
      </Text>
      <View style={styles.divider} />
      <Ionicons name="speedometer-outline" size={14} color={palette.textMuted} />
      <Text style={styles.wind}>{resolvedWeather.windSpeed} km/h</Text>
      <View style={{ transform: [{ rotate: `${(resolvedWeather.windDir + 180) % 360}deg` }] }}>
        <Ionicons name="arrow-up-outline" size={14} color={palette.textMuted} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  temp: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  wind: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: palette.line,
    marginHorizontal: 2,
  },
})
