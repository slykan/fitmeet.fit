import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'

import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

export default function LoginScreen() {
  const setDemoSession = useAuthStore((state) => state.setDemoSession)
  const [email, setEmail] = useState('hello@fitmeet.fit')
  const [name, setName] = useState('FitMeet Demo')
  const disabled = useMemo(() => !email.trim() || !name.trim(), [email, name])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Link href="/welcome" asChild>
          <Pressable style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
        </Link>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Mobile alpha</Text>
          <Text style={styles.title}>Start with a demo session</Text>
          <Text style={styles.subtitle}>
            We are keeping the entry simple so we can shape the mobile flows first, then wire real auth cleanly.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={palette.textDim} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={palette.textDim}
            />
          </View>
        </View>

        <Pressable
          disabled={disabled}
          onPress={() => {
            setDemoSession({ name: name.trim(), email: email.trim() })
            router.replace('/(tabs)/hub')
          }}
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryLabel}>Enter FitMeet</Text>
          <Ionicons name="arrow-forward" size={18} color="#03110a" />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panel,
  },
  header: {
    gap: 10,
    marginTop: spacing.md,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  field: {
    gap: 8,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 54,
    borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    color: palette.text,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 'auto',
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryLabel: {
    color: '#041109',
    fontSize: 16,
    fontWeight: '800',
  },
})
