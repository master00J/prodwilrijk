import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice'

let listening = false
let onDetectedHandler: (() => void) | null = null
let lastTriggerAt = 0
const COOLDOWN_MS = 4000

const JARVIS_RE = /\b(hey\s+)?jarvis\b/i

function textFromResults(event: SpeechResultsEvent): string {
  return (event.value || []).join(' ').trim()
}

function maybeTrigger(text: string) {
  if (!listening || !onDetectedHandler) return
  if (!JARVIS_RE.test(text)) return
  const now = Date.now()
  if (now - lastTriggerAt < COOLDOWN_MS) return
  lastTriggerAt = now
  onDetectedHandler()
}

function bindVoiceHandlers() {
  Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
    maybeTrigger(textFromResults(event))
  }
  Voice.onSpeechResults = (event: SpeechResultsEvent) => {
    maybeTrigger(textFromResults(event))
  }
  Voice.onSpeechError = (event: SpeechErrorEvent) => {
    const code = event.error?.code
    if (code === '7' || code === '11') return
    console.warn('[voice-wake]', event.error?.message || 'speech error')
  }
  Voice.onSpeechEnd = () => {
    if (listening) {
      void restartVoiceListening().catch(() => {})
    }
  }
}

async function restartVoiceListening(): Promise<void> {
  try {
    await Voice.stop()
  } catch {
    // ignore
  }
  try {
    await Voice.start('nl-NL')
  } catch {
    await Voice.start('nl-BE')
  }
}

export async function startVoiceFallbackListener(onDetected: () => void): Promise<void> {
  const available = await Voice.isAvailable()
  if (!available) {
    throw new Error('Spraakherkenning is niet beschikbaar op dit toestel.')
  }

  onDetectedHandler = onDetected
  listening = true
  bindVoiceHandlers()
  await restartVoiceListening()
}

export async function stopVoiceFallbackListener(): Promise<void> {
  listening = false
  onDetectedHandler = null
  try {
    await Voice.stop()
  } catch {
    // ignore
  }
  try {
    await Voice.destroy()
  } catch {
    // ignore
  }
  Voice.removeAllListeners()
}

export function isVoiceFallbackListening(): boolean {
  return listening
}
