import * as GoogleAuthSession from 'expo-auth-session/providers/google'
import { Platform } from 'react-native'

import { googleOAuthConfig } from '@/src/lib/oauth-config'

let configured = false

function getGoogleSignin() {
  return require('@react-native-google-signin/google-signin').GoogleSignin
}

function ensureGoogleSigninConfigured() {
  if (configured || Platform.OS !== 'android') return
  getGoogleSignin().configure({ webClientId: googleOAuthConfig.webClientId })
  configured = true
}

export async function signInWithGoogleNative(): Promise<string | null> {
  if (Platform.OS !== 'android') return null

  const GoogleSignin = getGoogleSignin()
  ensureGoogleSigninConfigured()
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

  const result = await GoogleSignin.signIn()
  if (result.type !== 'success') return null

  const tokens = await GoogleSignin.getTokens()
  return tokens.accessToken
}

export function useGoogleBrowserAuth() {
  return GoogleAuthSession.useAuthRequest({
    androidClientId: googleOAuthConfig.androidClientId,
    iosClientId: googleOAuthConfig.iosClientId,
    webClientId: googleOAuthConfig.webClientId,
    redirectUri: 'fitmeet://oauthredirect',
  })
}
