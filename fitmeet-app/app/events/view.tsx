import { Redirect, useLocalSearchParams } from 'expo-router'

export default function ViewRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (!id) return <Redirect href="/(tabs)/meet" />
  return <Redirect href={`/event/${id}`} />
}
