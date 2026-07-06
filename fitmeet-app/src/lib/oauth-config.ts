import Constants from 'expo-constants'

type ExpoExtra = {
  googleAndroidClientId?: string
  googleIosClientId?: string
  googleWebClientId?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra

export const googleOAuthConfig = {
  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    extra.googleAndroidClientId ??
    '206851995035-f0vleunetrb0nqog6dm24e1j1aq6tgqa.apps.googleusercontent.com',
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
    extra.googleIosClientId ??
    '206851995035-ojpju360jnjhbogugko32a1eh6gpf6d5.apps.googleusercontent.com',
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    extra.googleWebClientId ??
    '206851995035-0cn2pik52tpaprm9hsshss7uhehab2h0.apps.googleusercontent.com',
}
