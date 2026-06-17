import { Redirect, useLocalSearchParams } from 'expo-router'

export default function CheckInRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (!id) return <Redirect href="/(tabs)/meet" />
  return <Redirect href={`/event/${id}?checkin=1`} />
}
