import { GoogleSignin } from '@react-native-google-signin/google-signin'
import * as GoogleAuthSession from 'expo-auth-session/providers/google'
import { Platform } from 'react-native'

import { googleOAuthConfig } from '@/src/lib/oauth-config'

let configured = false

function ensureGoogleSigninConfigured() {
  if (configured || Platform.OS !== 'android') {
    return
  }

  GoogleSignin.configure({
    webClientId: googleOAuthConfig.webClientId,
  })

  configured = true
}

export async function signInWithGoogleNative(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null
  }

  ensureGoogleSigninConfigured()
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

  const result = await GoogleSignin.signIn()
  if (result.type !== 'success') {
    return null
  }

  const tokens = await GoogleSignin.getTokens()
  return tokens.accessToken
}

export function useGoogleBrowserAuth() {
  return GoogleAuthSession.useAuthRequest({
    androidClientId: googleOAuthConfig.androidClientId,
    webClientId: googleOAuthConfig.webClientId,
    redirectUri: 'fitmeet://oauthredirect',
  })
}
