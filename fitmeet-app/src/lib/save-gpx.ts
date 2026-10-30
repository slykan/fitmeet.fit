import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import { Alert, Platform, Share } from 'react-native'

/** File name from a route/event title: letters, digits and dashes only (some file providers reject the rest). */
export function gpxFileName(title: string): string {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'route'}.gpx`
}

/** Download a GPX from the API into the cache; throws on a non-200 answer (downloadAsync itself does not). */
export async function downloadGpx(url: string, filename: string, token?: string | null): Promise<string> {
  const fileUri = FileSystem.cacheDirectory + filename
  const res = await FileSystem.downloadAsync(url, fileUri, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (res.status !== 200) throw new Error(`GPX download failed (${res.status})`)
  return FileSystem.readAsStringAsync(fileUri)
}

/**
 * Save a GPX file for the user.
 * iOS: share sheet. Android: folder picker (Storage Access Framework). Some file providers
 * (e.g. HUAWEI / HarmonyOS file manager) refuse to create a document with the GPX MIME type,
 * so it retries as a generic file and, if saving still fails, opens the Android share sheet
 * ("Save to Files", Drive, Komoot, Garmin …) so the user always gets the file.
 */
export async function saveGpxFile(filename: string, xml: string): Promise<void> {
  const cacheUri = FileSystem.cacheDirectory + filename
  await FileSystem.writeAsStringAsync(cacheUri, xml)

  if (Platform.OS === 'ios') {
    await Share.share({ url: cacheUri })
    return
  }

  try {
    const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!perms.granted) return // user closed the folder picker
    let destUri: string
    try {
      destUri = await FileSystem.StorageAccessFramework.createFileAsync(perms.directoryUri, filename, 'application/gpx+xml')
    } catch {
      destUri = await FileSystem.StorageAccessFramework.createFileAsync(perms.directoryUri, filename, 'application/octet-stream')
    }
    await FileSystem.writeAsStringAsync(destUri, xml)
    Alert.alert('GPX saved', `${filename} saved to the selected folder.`)
  } catch {
    await shareFileAndroid(cacheUri)
  }
}

async function shareFileAndroid(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri)
  await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
    type: 'application/gpx+xml',
    extra: { 'android.intent.extra.STREAM': contentUri },
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  })
}
