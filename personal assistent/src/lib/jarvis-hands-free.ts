import { Audio } from 'expo-av'
import * as SecureStore from 'expo-secure-store'
import { AppState, Platform } from 'react-native'
import {
  ensurePostNotificationsIfNeeded,
  ensureRecordAudioForWakeWord,
  waitAfterPermissionDialog,
} from '@/lib/android-permissions'
import { bringAssistantToForeground } from '@/lib/bring-assistant-foreground'
import { nativeAudioCooldown } from '@/lib/native-audio-cooldown'
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
let lifecycleChain: Promise<void> = Promise.resolve()
let toggleGeneration = 0

function setStatus(next: HandsFreeStatus, message: string) {
  status = next
  statusMessage = message
  for (const fn of listeners) fn(next, message)
}

function runHandsFreeLifecycle<T>(fn: () => Promise<T>): Promise<T> {
  const run = lifecycleChain.then(fn, fn)
  lifecycleChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
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

/** Alleen voor weergave — start nooit automatisch de microfoon. */
export async function loadHandsFreePreference(): Promise<boolean> {
  return false
}

export async function saveHandsFreePreference(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(HANDS_FREE_KEY, on ? '1' : '0')
  if (!on) {
    await SecureStore.setItemAsync(HANDS_FREE_OK_KEY, '0').catch(() => {})
  }
}

/** Verwijdert oude "aan"-voorkeur (native service draait dan niet meer). */
export async function clearStaleHandsFreePreference(): Promise<void> {
  await saveHandsFreePreference(false)
  await markHandsFreeStartOk(false)
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
    await waitAfterPermissionDialog(400)
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
    setStatus('listening', 'Luisteren op "Hey Jarvis"…')
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

async function startHandsFreeInner(): Promise<void> {
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
          'Hey Jarvis actief — melding blijft zichtbaar. Zeg "Hey Jarvis".'
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
          : 'Hey Jarvis alleen betrouwbaar met app open.'
      )
    }
  }
}

export async function startHandsFree(): Promise<void> {
  return runHandsFreeLifecycle(() => startHandsFreeInner())
}

async function stopHandsFreeInner(): Promise<void> {
  enabled = false
  pausedForLive = false
  await stopWakeWordListener()
  await releaseBackgroundKeeper()
  await nativeAudioCooldown(400)
  setStatus('off', 'Hands-free uit')
}

export async function stopHandsFree(): Promise<void> {
  return runHandsFreeLifecycle(() => stopHandsFreeInner())
}

export async function setHandsFreeEnabled(
  on: boolean,
  options?: { skipSave?: boolean }
): Promise<void> {
  return runHandsFreeLifecycle(async () => {
    const gen = ++toggleGeneration

    if (!on) {
      if (!options?.skipSave) await saveHandsFreePreference(false)
      await stopHandsFreeInner()
      return
    }

    await stopHandsFreeInner()
    await releaseWakeWordListener()
    await nativeAudioCooldown(600)

    if (gen !== toggleGeneration) return

    try {
      await startHandsFreeInner()
      if (gen !== toggleGeneration) {
        await stopHandsFreeInner()
        return
      }
      await markHandsFreeStartOk(true)
      if (!options?.skipSave) await saveHandsFreePreference(true)
    } catch (err) {
      enabled = false
      await markHandsFreeStartOk(false)
      if (!options?.skipSave) await saveHandsFreePreference(false)
      await releaseBackgroundKeeper()
      await releaseWakeWordListener()
      await nativeAudioCooldown(300)
      throw err
    }
  })
}

export function isHandsFreeEnabled(): boolean {
  return enabled && isWakeWordListening()
}

export async function initHandsFreeOnLogin(onWake: () => Promise<void>): Promise<void> {
  registerWakeHandler(onWake)
  await clearStaleHandsFreePreference()
  enabled = false
  pausedForLive = false
  setStatus('off', getWakeWordEngineHint())
}

export async function teardownHandsFree(): Promise<void> {
  toggleGeneration += 1
  await stopHandsFreeInner()
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
      return
    }

    if (next === 'active') {
      void beginWakeWord().catch(() => {})
    } else {
      void stopWakeWordListener().catch(() => {})
    }
  })
}
