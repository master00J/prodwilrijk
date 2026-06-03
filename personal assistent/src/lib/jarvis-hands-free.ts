import { Audio } from 'expo-av'
import * as SecureStore from 'expo-secure-store'
import { AppState, PermissionsAndroid, Platform } from 'react-native'
import BackgroundJob from 'react-native-background-actions'
import {
  getWakeWordEngine,
  getWakeWordEngineHint,
  isWakeWordListening,
  releaseWakeWordListener,
  startWakeWordListener,
  stopWakeWordListener,
} from '@/lib/wake-word'

const HANDS_FREE_KEY = 'jarvis_hands_free_enabled'
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

export async function loadHandsFreePreference(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(HANDS_FREE_KEY)
    return v !== '0'
  } catch {
    return true
  }
}

export async function saveHandsFreePreference(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(HANDS_FREE_KEY, on ? '1' : '0')
}

async function ensureAndroidPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return

  const toRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
  if (Platform.Version >= 33) {
    toRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
  }

  const results = await PermissionsAndroid.requestMultiple(toRequest)
  const mic = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
  if (mic === PermissionsAndroid.RESULTS.DENIED || mic === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    throw new Error('Microfoon-toestemming is vereist voor "Hey Jarvis".')
  }
}

const backgroundTask = async () => {
  while (BackgroundJob.isRunning()) {
    await sleep(2000)
  }
}

const backgroundOptions = {
  taskName: 'JarvisWakeWord',
  taskTitle: 'Jarvis luistert',
  taskDesc: 'Zeg "Jarvis" om de assistent te starten (hands-free)',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#1a4b8c',
  linkingURI: 'prodwilrijk-assistant://assistant',
  parameters: {},
}

async function startAndroidForegroundKeeper(): Promise<void> {
  if (Platform.OS !== 'android') return
  if (BackgroundJob.isRunning()) return
  await BackgroundJob.start(backgroundTask, backgroundOptions)
}

async function stopAndroidForegroundKeeper(): Promise<void> {
  if (Platform.OS !== 'android') return
  if (!BackgroundJob.isRunning()) return
  await BackgroundJob.stop()
}

async function beginWakeWord(): Promise<void> {
  await startWakeWordListener(() => {
    void handleWakeDetected()
  })
  const hint = getWakeWordEngine() === 'porcupine' ? 'Picovoice' : 'spraakherkenning (tijdelijk)'
  setStatus('listening', `Luisteren op "Jarvis" (${hint})…`)
}

async function handleWakeDetected(): Promise<void> {
  if (!enabled || pausedForLive) return
  const now = Date.now()
  if (now - lastWakeAt < WAKE_COOLDOWN_MS) return
  lastWakeAt = now

  setStatus('activating', 'Jarvis gehoord — live spraak start…')
  pausedForLive = true
  await stopWakeWordListener()

  try {
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

/** Na stop live spraak: wake word weer aanzetten. */
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
  await ensureAndroidPermissions()

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })

  await startAndroidForegroundKeeper()
  await beginWakeWord()
  enabled = true
  pausedForLive = false
}

export async function stopHandsFree(): Promise<void> {
  enabled = false
  pausedForLive = false
  await stopWakeWordListener()
  await stopAndroidForegroundKeeper()
  setStatus('off', 'Hands-free uit')
}

export async function setHandsFreeEnabled(
  on: boolean,
  options?: { skipSave?: boolean }
): Promise<void> {
  if (!options?.skipSave) await saveHandsFreePreference(on)

  if (!on) {
    await stopHandsFree()
    return
  }

  try {
    await startHandsFree()
  } catch (err) {
    enabled = false
    await stopAndroidForegroundKeeper()
    await releaseWakeWordListener()
    throw err
  }
}

export function isHandsFreeEnabled(): boolean {
  return enabled && isWakeWordListening()
}

export async function initHandsFreeOnLogin(onWake: () => Promise<void>): Promise<void> {
  registerWakeHandler(onWake)
  const pref = await loadHandsFreePreference()
  if (!pref) {
    setStatus('off', 'Hands-free uit — zet aan om "Jarvis" te gebruiken')
    return
  }
  try {
    await setHandsFreeEnabled(true, { skipSave: true })
  } catch (err) {
    setStatus('error', err instanceof Error ? err.message : 'Hands-free start mislukt')
  }
}

export async function teardownHandsFree(): Promise<void> {
  await stopHandsFree()
  await releaseWakeWordListener()
  onWakeCallback = null
  appStateSub?.remove()
  appStateSub = null
}

/** iOS: alleen luisteren als app op voorgrond; Android: FGS houdt mic actief. */
export function attachAppStateHandsFree(): void {
  appStateSub?.remove()
  appStateSub = AppState.addEventListener('change', next => {
    if (!enabled || Platform.OS !== 'ios') return
    if (next === 'active' && !pausedForLive) {
      void beginWakeWord().catch(() => {})
    } else if (next !== 'active') {
      void stopWakeWordListener().catch(() => {})
    }
  })
}
