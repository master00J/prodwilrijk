import { AppState, PermissionsAndroid, Platform } from 'react-native'
import { VoiceProcessor } from '@picovoice/react-native-voice-processor'

/** Wacht tot de activity weer stabiel is na een systeem-permissiedialoog. */
export function waitAfterPermissionDialog(ms = 600): Promise<void> {
  return new Promise(resolve => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      sub.remove()
      clearTimeout(fallback)
      resolve()
    }

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setTimeout(finish, ms)
      }
    })

    const fallback = setTimeout(finish, ms + 1200)

    if (AppState.currentState === 'active') {
      setTimeout(finish, ms)
    }
  })
}

/** Picovoice-pad: één dialoog, geen mix met PermissionsAndroid.requestMultiple. */
export async function ensureRecordAudioForWakeWord(): Promise<void> {
  const vp = VoiceProcessor.instance
  const granted = await vp.hasRecordAudioPermission()
  if (!granted) {
    throw new Error('Microfoon-toestemming is vereist voor "Hey Jarvis".')
  }
  await waitAfterPermissionDialog(700)
}

export async function ensurePostNotificationsIfNeeded(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return

  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  const already = await PermissionsAndroid.check(perm)
  if (already) return

  await PermissionsAndroid.request(perm)
  await waitAfterPermissionDialog(400)
}
