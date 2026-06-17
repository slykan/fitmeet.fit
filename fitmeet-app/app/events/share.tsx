import { Redirect, useLocalSearchParams } from 'expo-router'

export default function ShareRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (!id) return <Redirect href="/(tabs)/meet" />
  return <Redirect href={`/event/${id}`} />
}
