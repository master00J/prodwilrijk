import { Platform } from 'react-native'
import { USE_PICOVOICE_WAKE } from '@/config'
import {
  isOpenWakeWordPreferred,
  isOpenWakeWordListening,
  prepareOpenWakeWord,
  releaseOpenWakeWordListener,
  startOpenWakeWordListener,
  stopOpenWakeWordListener,
} from '@/lib/wake-word-openwakeword'
import {
  isPorcupineConfigured,
  releasePorcupineListener,
  startPorcupineListener,
  stopPorcupineListener,
  isPorcupineListening,
} from '@/lib/wake-word-porcupine'
import {
  isVoiceFallbackListening,
  startVoiceFallbackListener,
  stopVoiceFallbackListener,
} from '@/lib/wake-word-voice-fallback'

export { isPorcupineConfigured }

export type WakeWordEngine = 'openwakeword' | 'porcupine' | 'voice_fallback'

let activeEngine: WakeWordEngine | null = null

export async function resolveWakeWordEngine(): Promise<WakeWordEngine> {
  if (USE_PICOVOICE_WAKE && isPorcupineConfigured()) {
    return 'porcupine'
  }
  if (isOpenWakeWordPreferred() && (await prepareOpenWakeWord())) {
    return 'openwakeword'
  }
  if (isPorcupineConfigured()) {
    return 'porcupine'
  }
  return 'voice_fallback'
}

export function getWakeWordEngine(): WakeWordEngine {
  return activeEngine ?? 'openwakeword'
}

export function isWakeWordConfigured(): boolean {
  return true
}

export function getWakeWordEngineLabel(): string {
  const engine = getWakeWordEngine()
  if (engine === 'openwakeword') return 'openWakeWord (offline, Hey Jarvis)'
  if (engine === 'porcupine') return 'Picovoice'
  return 'Spraakherkenning (fallback)'
}

export function getWakeWordEngineHint(): string {
  const engine = getWakeWordEngine()
  if (engine === 'openwakeword') {
    return 'Zeg "Hey Jarvis" (openWakeWord, offline). Eerste start downloadt modellen (~3 MB).'
  }
  if (engine === 'porcupine') {
    return 'Zeg "Jarvis" via Picovoice.'
  }
  if (Platform.OS === 'android') {
    return 'Zeg "Hey Jarvis" of "Jarvis" met de app open (spraakherkenning). Offline wake word: zet EXPO_PUBLIC_USE_OPENWAKEWORD_ON_ANDROID=true bij build.'
  }
  return 'Fallback spraakherkenning met app open.'
}

export async function startWakeWordListener(onDetected: () => void): Promise<void> {
  try {
    activeEngine = await resolveWakeWordEngine()

    if (activeEngine === 'openwakeword') {
      await startOpenWakeWordListener(onDetected)
      return
    }
    if (activeEngine === 'porcupine') {
      await startPorcupineListener(onDetected)
      return
    }
    await startVoiceFallbackListener(onDetected)
  } catch (err) {
    console.warn('[wake-word] start mislukt, fallback', err instanceof Error ? err.message : err)
    await stopOpenWakeWordListener().catch(() => {})
    await stopPorcupineListener().catch(() => {})
    activeEngine = 'voice_fallback'
    await startVoiceFallbackListener(onDetected)
  }
}

export async function stopWakeWordListener(): Promise<void> {
  if (activeEngine === 'openwakeword') {
    await stopOpenWakeWordListener()
  } else if (activeEngine === 'porcupine') {
    await stopPorcupineListener()
  } else {
    await stopVoiceFallbackListener()
  }
}

export async function releaseWakeWordListener(): Promise<void> {
  await stopOpenWakeWordListener()
  await stopPorcupineListener()
  await stopVoiceFallbackListener()
  await releaseOpenWakeWordListener()
  await releasePorcupineListener()
  activeEngine = null
}

export function isWakeWordListening(): boolean {
  if (activeEngine === 'openwakeword') return isOpenWakeWordListening()
  if (activeEngine === 'porcupine') return isPorcupineListening()
  return isVoiceFallbackListening()
}
