import * as Speech from 'expo-speech'

let speaking = false

export async function speak(text: string): Promise<void> {
  const cleaned = text.trim()
  if (!cleaned) return

  await stopSpeaking()

  return new Promise((resolve, reject) => {
    speaking = true
    Speech.speak(cleaned, {
      language: 'nl-BE',
      pitch: 1,
      rate: 0.95,
      onDone: () => {
        speaking = false
        resolve()
      },
      onStopped: () => {
        speaking = false
        resolve()
      },
      onError: (error: unknown) => {
        speaking = false
        reject(error)
      },
    })
  })
}

export async function stopSpeaking(): Promise<void> {
  if (!speaking) return
  Speech.stop()
  speaking = false
}

export function isSpeaking(): boolean {
  return speaking
}
