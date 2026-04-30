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
}

export function WeatherBadge({ lat, lng, isoDate, hour }: Props) {
  const [weather, setWeather] = useState<EventWeather | null>(null)

  useEffect(() => {
    fetchEventWeather(lat, lng, isoDate, hour).then(setWeather)
  }, [lat, lng, isoDate, hour])

  if (!weather) return null

  return (
    <View style={styles.row}>
      <Ionicons name={weatherIconName(weather.code) as any} size={13} color={palette.textDim} />
      <Text style={styles.temp}>
        {weather.tempMin}°/{weather.tempMax}°
      </Text>
      <View style={styles.divider} />
      <Ionicons name="speedometer-outline" size={13} color={palette.textDim} />
      <Text style={styles.wind}>{weather.windSpeed} km/h</Text>
      <View style={{ transform: [{ rotate: `${weather.windDir}deg` }] }}>
        <Ionicons name="arrow-up-outline" size={13} color={palette.textDim} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  temp: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  wind: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: palette.line,
    marginHorizontal: 2,
  },
})
