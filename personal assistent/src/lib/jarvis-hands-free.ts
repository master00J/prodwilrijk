import { Audio } from 'expo-av'
import * as SecureStore from 'expo-secure-store'
import { AppState, Platform } from 'react-native'
import {
  ensurePostNotificationsIfNeeded,
  ensureRecordAudioForWakeWord,
  waitAfterPermissionDialog,
} from '@/lib/android-permissions'
import { bringAssistantToForeground } from '@/lib/bring-assistant-foreground'
import { USE_OPENWAKEWORD_ON_ANDROID } from '@/config'
import { acquireBackgroundKeeper, releaseBackgroundKeeper } from '@/lib/background-keeper'
import {
  getWakeWordEngine,
  getWakeWordEngineHint,
  isWakeWordListening,
  releaseWakeWordListener,
  startWakeWordListener,
  stopWakeWordListener,
} from '@/lib/wake-word'

const HANDS_FREE_KEY = 'jarvis_hands_free_enabled'
const HANDS_FREE_OK_KEY = 'jarvis_hands_free_start_ok'
const WAKE_COOLDOWN_MS = 4000

export type HandsFreeStatus =
  | 'off'
  | 'starting'
  | 'listening'
  | 'activating'
  | 'live_active'
  | 'error'

type Listener = (status: HandsFreeStatus, message: string) => void

let status: HandsFreeStatus = 'off'
let statusMessage = ''
let listeners: Listener[] = []
let enabled = false
let lastWakeAt = 0
let pausedForLive = false
let onWakeCallback: (() => Promise<void>) | null = null
let appStateSub: { remove: () => void } | null = null

function setStatus(next: HandsFreeStatus, message: string) {
  status = next
  statusMessage = message
  for (const fn of listeners) fn(next, message)
}

export function subscribeHandsFree(listener: Listener): () => void {
  listeners.push(listener)
  listener(status, statusMessage)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

export function getHandsFreeStatus(): { status: HandsFreeStatus; message: string } {
  return { status, message: statusMessage }
}

async function markHandsFreeStartOk(ok: boolean): Promise<void> {
  await SecureStore.setItemAsync(HANDS_FREE_OK_KEY, ok ? '1' : '0')
}

async function wasHandsFreeStartConfirmed(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(HANDS_FREE_OK_KEY)) === '1'
  } catch {
    return false
  }
}

/** Schakelaar alleen aan als voorkeur én laatste start geslaagd was. */
export async function loadHandsFreePreference(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(HANDS_FREE_KEY)
    if (v !== '1') return false
    return await wasHandsFreeStartConfirmed()
  } catch {
    return false
  }
}

export async function saveHandsFreePreference(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(HANDS_FREE_KEY, on ? '1' : '0')
  if (!on) {
    await SecureStore.setItemAsync(HANDS_FREE_OK_KEY, '0').catch(() => {})
  }
}

async function ensureHandsFreePermissions(): Promise<void> {
  if (Platform.OS === 'android' && USE_OPENWAKEWORD_ON_ANDROID) {
    await ensureRecordAudioForWakeWord()
    return
  }

  const { status: perm } = await Audio.requestPermissionsAsync()
  if (perm !== 'granted') {
    throw new Error('Microfoon-toestemming is vereist voor "Hey Jarvis".')
  }
  if (Platform.OS === 'android') {
    await waitAfterPermissionDialog(900)
  }
}

export function isHandsFreeServiceEnabled(): boolean {
  return enabled
}

async function beginWakeWord(): Promise<void> {
  if (Platform.OS === 'android') {
    await waitAfterPermissionDialog(500)
  }
  await startWakeWordListener(() => {
    void handleWakeDetected()
  })
  const engine = getWakeWordEngine()
  const hint =
    engine === 'openwakeword'
      ? 'openWakeWord — zeg Hey Jarvis'
      : engine === 'porcupine'
        ? 'Picovoice'
        : 'spraakherkenning — app open'
  setStatus('listening', `Luisteren (${hint})…`)
}

async function handleWakeDetected(): Promise<void> {
  if (!enabled || pausedForLive) return
  const now = Date.now()
  if (now - lastWakeAt < WAKE_COOLDOWN_MS) return
  lastWakeAt = now

  setStatus('activating', 'Jarvis gehoord — app wordt geopend…')
  pausedForLive = true
  await stopWakeWordListener()

  try {
    await bringAssistantToForeground()
    if (Platform.OS === 'android') {
      await waitAfterPermissionDialog(400)
    }
    setStatus('activating', 'Live spraak start…')
    await onWakeCallback?.()
    setStatus('live_active', 'Live gesprek actief. Zeg "stop live" of tik Stop.')
  } catch (err) {
    setStatus('error', err instanceof Error ? err.message : 'Live spraak start mislukt')
    pausedForLive = false
    if (enabled) {
      try {
        await beginWakeWord()
      } catch {
        setStatus('error', 'Kon wake word niet herstarten')
      }
    }
  }
}

export async function resumeHandsFreeAfterLive(): Promise<void> {
  if (!enabled) return
  pausedForLive = false
  try {
    await beginWakeWord()
    setStatus('listening', 'Luisteren op "Jarvis"…')
  } catch (err) {
    setStatus('error', err instanceof Error ? err.message : 'Wake word herstart mislukt')
  }
}

export async function pauseHandsFreeForLive(): Promise<void> {
  pausedForLive = true
  await stopWakeWordListener()
  if (enabled) setStatus('live_active', 'Live gesprek actief')
}

export function registerWakeHandler(handler: () => Promise<void>): void {
  onWakeCallback = handler
}

export async function startHandsFree(): Promise<void> {
  setStatus('starting', 'Hands-free Jarvis wordt gestart…')
  await ensureHandsFreePermissions()

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })

  await beginWakeWord()
  enabled = true
  pausedForLive = false

  if (Platform.OS === 'android') {
    try {
      await ensurePostNotificationsIfNeeded()
      await acquireBackgroundKeeper()
      if (USE_OPENWAKEWORD_ON_ANDROID) {
        setStatus(
          'listening',
          'Hey Jarvis actief op achtergrond — melding blijft zichtbaar. Zeg "Hey Jarvis".'
        )
      }
    } catch (err) {
      console.warn(
        '[hands-free] achtergrondmelding',
        err instanceof Error ? err.message : err
      )
      setStatus(
        'listening',
        USE_OPENWAKEWORD_ON_ANDROID
          ? 'Hey Jarvis luistert — zet batterij-optimalisatie uit voor betrouwbare achtergrond.'
          : 'Hey Jarvis alleen betrouwbaar met app open (geen achtergrondmelding).'
      )
    }
  }
}

export async function stopHandsFree(): Promise<void> {
  enabled = false
  pausedForLive = false
  await stopWakeWordListener()
  await releaseBackgroundKeeper()
  setStatus('off', 'Hands-free uit')
}

export async function setHandsFreeEnabled(
  on: boolean,
  options?: { skipSave?: boolean }
): Promise<void> {
  if (!on) {
    if (!options?.skipSave) await saveHandsFreePreference(false)
    await stopHandsFree()
    return
  }

  try {
    await startHandsFree()
    await markHandsFreeStartOk(true)
    if (!options?.skipSave) await saveHandsFreePreference(true)
  } catch (err) {
    enabled = false
    await markHandsFreeStartOk(false)
    if (!options?.skipSave) await saveHandsFreePreference(false)
    await releaseBackgroundKeeper()
    await releaseWakeWordListener()
    throw err
  }
}

export function isHandsFreeEnabled(): boolean {
  return enabled && isWakeWordListening()
}

/** Geen auto-start bij login — alleen handmatig via schakelaar (voorkomt crash bij openen). */
export async function initHandsFreeOnLogin(onWake: () => Promise<void>): Promise<void> {
  registerWakeHandler(onWake)

  const pref = (await SecureStore.getItemAsync(HANDS_FREE_KEY).catch(() => null)) === '1'
  const confirmed = await wasHandsFreeStartConfirmed()

  if (pref && !confirmed) {
    await saveHandsFreePreference(false)
  }

  setStatus('off', getWakeWordEngineHint())
}

export async function teardownHandsFree(): Promise<void> {
  await stopHandsFree()
  await releaseWakeWordListener()
  onWakeCallback = null
  appStateSub?.remove()
  appStateSub = null
}

export function attachAppStateHandsFree(): void {
  appStateSub?.remove()
  appStateSub = AppState.addEventListener('change', next => {
    if (!enabled || pausedForLive) return

    if (Platform.OS === 'android') {
      if (next === 'active' && !isWakeWordListening()) {
        void beginWakeWord().catch(() => {
          setStatus('error', 'Hey Jarvis kon niet herstarten — zet schakelaar opnieuw aan.')
        })
      }
      return
    }

    if (next === 'active') {
      void beginWakeWord().catch(() => {})
    } else {
      void stopWakeWordListener().catch(() => {})
    }
  })
}
