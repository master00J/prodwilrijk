import { Platform } from 'react-native'
import {
  isPorcupineConfigured,
  releasePorcupineListener,
  startPorcupineListener,
  stopPorcupineListener,
  isPorcupineListening,
} from '@/lib/wake-word-porcupine'

export { isPorcupineConfigured }
import {
  isVoiceFallbackListening,
  startVoiceFallbackListener,
  stopVoiceFallbackListener,
} from '@/lib/wake-word-voice-fallback'

export type WakeWordEngine = 'porcupine' | 'voice_fallback'

/** Picovoice-key aanwezig → lage batterij + achtergrond. Anders tijdelijke spraakherkenning. */
export function getWakeWordEngine(): WakeWordEngine {
  return isPorcupineConfigured() ? 'porcupine' : 'voice_fallback'
}

export function isWakeWordConfigured(): boolean {
  return true
}

export function getWakeWordEngineLabel(): string {
  return getWakeWordEngine() === 'porcupine'
    ? 'Picovoice (aanbevolen)'
    : 'Spraakherkenning (tijdelijk, tot Picovoice-key)'
}

export function getWakeWordEngineHint(): string {
  if (getWakeWordEngine() === 'porcupine') {
    return 'Zeg "Jarvis". Werkt ook op achtergrond via de melding.'
  }
  if (Platform.OS === 'android') {
    return 'Zonder Picovoice-key: zeg "Jarvis" of "Hey Jarvis". Houd de app het liefst open; achtergrond is beperkt. Na goedkeuring op console.picovoice.ai werkt het volledig.'
  }
  return 'Zonder Picovoice-key: zeg "Jarvis" met de app open. Voeg later EXPO_PUBLIC_PICOVOICE_ACCESS_KEY toe voor betere detectie.'
}

export async function startWakeWordListener(onDetected: () => void): Promise<void> {
  if (getWakeWordEngine() === 'porcupine') {
    await startPorcupineListener(onDetected)
    return
  }
  await startVoiceFallbackListener(onDetected)
}

export async function stopWakeWordListener(): Promise<void> {
  if (getWakeWordEngine() === 'porcupine') {
    await stopPorcupineListener()
    return
  }
  await stopVoiceFallbackListener()
}

export async function releaseWakeWordListener(): Promise<void> {
  await stopPorcupineListener()
  await stopVoiceFallbackListener()
  await releasePorcupineListener()
}

export function isWakeWordListening(): boolean {
  return getWakeWordEngine() === 'porcupine' ? isPorcupineListening() : isVoiceFallbackListening()
}
