import { BuiltInKeywords, PorcupineManager } from '@picovoice/porcupine-react-native'
import { PICOVOICE_ACCESS_KEY } from '@/config'

let manager: PorcupineManager | null = null
let listening = false

export function isPorcupineConfigured(): boolean {
  return Boolean(PICOVOICE_ACCESS_KEY?.trim())
}

export async function startPorcupineListener(onDetected: () => void): Promise<void> {
  if (!isPorcupineConfigured()) {
    throw new Error('Picovoice AccessKey ontbreekt.')
  }
  if (listening && manager) return

  if (!manager) {
    manager = await PorcupineManager.fromBuiltInKeywords(
      PICOVOICE_ACCESS_KEY.trim(),
      [BuiltInKeywords.JARVIS],
      (keywordIndex: number) => {
        if (keywordIndex >= 0) onDetected()
      },
      (error: Error) => {
        console.warn('[porcupine]', error.message)
      }
    )
  }

  await manager.start()
  listening = true
}

export async function stopPorcupineListener(): Promise<void> {
  if (!manager || !listening) return
  try {
    await manager.stop()
  } catch {
    // ignore
  }
  listening = false
}

export async function releasePorcupineListener(): Promise<void> {
  await stopPorcupineListener()
  if (manager) {
    try {
      await manager.delete()
    } catch {
      // ignore
    }
    manager = null
  }
}

export function isPorcupineListening(): boolean {
  return listening
}
