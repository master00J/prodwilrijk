import * as FileSystem from 'expo-file-system'
import { VoiceProcessor } from '@picovoice/react-native-voice-processor'
import { Openwakeword } from 'react-native-openwakeword'
import { Platform } from 'react-native'
import { nativeAudioCooldown } from '@/lib/native-audio-cooldown'
import { OPENWAKEWORD_THRESHOLD, USE_OPENWAKEWORD_ON_ANDROID, USE_PICOVOICE_WAKE } from '@/config'

const MODEL_RELEASE = 'https://github.com/dscripka/openWakeWord/releases/download/v0.5.1'
const MODEL_FILES = [
  'melspectrogram.tflite',
  'embedding_model.tflite',
  'hey_jarvis_v0.1.tflite',
] as const

const FRAME_LENGTH = 1280
const SAMPLE_RATE = 16000

/** Eén keer per app-sessie laden — tweede loadModels() crasht native. */
let modelsLoadedInSession = false
let prepareInFlight: Promise<boolean> | null = null
let listening = false
let onDetectedHandler: (() => void) | null = null
let lastTriggerAt = 0
const COOLDOWN_MS = 3500

let frameListener: ((frame: number[]) => void) | null = null

export function isOpenWakeWordPreferred(): boolean {
  if (USE_PICOVOICE_WAKE) return false
  if (Platform.OS === 'android' && !USE_OPENWAKEWORD_ON_ANDROID) return false
  return true
}

function modelDir(): string {
  const base = FileSystem.documentDirectory
  if (!base) throw new Error('App-opslag niet beschikbaar.')
  return `${base}openwakeword/`
}

async function downloadModelsIfNeeded(): Promise<{
  mel: string
  embedding: string
  wake: string
}> {
  const dir = modelDir()
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {})

  for (const file of MODEL_FILES) {
    const dest = `${dir}${file}`
    const info = await FileSystem.getInfoAsync(dest)
    if (!info.exists) {
      await FileSystem.downloadAsync(`${MODEL_RELEASE}/${file}`, dest)
    }
  }

  return {
    mel: `${dir}melspectrogram.tflite`,
    embedding: `${dir}embedding_model.tflite`,
    wake: `${dir}hey_jarvis_v0.1.tflite`,
  }
}

async function loadModelsOncePerSession(): Promise<boolean> {
  if (!isOpenWakeWordPreferred()) return false
  if (modelsLoadedInSession) return true

  try {
    const paths = await downloadModelsIfNeeded()
    const loaded = Openwakeword.loadModels(paths.mel, paths.embedding, paths.wake)
    if (!loaded) return false
    Openwakeword.setThreshold(OPENWAKEWORD_THRESHOLD)
    modelsLoadedInSession = true
    return true
  } catch (err) {
    console.warn('[openwakeword] loadModels', err instanceof Error ? err.message : err)
    modelsLoadedInSession = false
    return false
  }
}

export async function prepareOpenWakeWord(): Promise<boolean> {
  if (!isOpenWakeWordPreferred()) return false
  if (modelsLoadedInSession) return true
  if (prepareInFlight) return prepareInFlight
  prepareInFlight = loadModelsOncePerSession().finally(() => {
    prepareInFlight = null
  })
  return prepareInFlight
}

function pcmFrameToBuffer(frame: number[]): ArrayBuffer {
  const int16 = new Int16Array(frame.length)
  for (let i = 0; i < frame.length; i++) {
    const sample = frame[i]
    if (sample >= -32768 && sample <= 32767) {
      int16[i] = sample
    } else {
      const clamped = Math.max(-1, Math.min(1, sample))
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767
    }
  }
  return int16.buffer
}

function detachFrameListener() {
  const vp = VoiceProcessor.instance
  if (frameListener) {
    vp.removeFrameListener(frameListener)
    frameListener = null
  }
}

function attachFrameListener() {
  const vp = VoiceProcessor.instance
  detachFrameListener()
  frameListener = (frame: number[]) => {
    if (!listening || !onDetectedHandler || frame.length === 0) return
    try {
      const result = Openwakeword.processFrame(pcmFrameToBuffer(frame))
      if (!result.isDetected) return
      const now = Date.now()
      if (now - lastTriggerAt < COOLDOWN_MS) return
      lastTriggerAt = now
      onDetectedHandler()
    } catch {
      // frame overslaan
    }
  }
  vp.addFrameListener(frameListener)
}

async function ensureVoiceProcessorFullyStopped(): Promise<void> {
  listening = false
  onDetectedHandler = null
  detachFrameListener()

  const vp = VoiceProcessor.instance
  try {
    if (await vp.isRecording()) {
      await vp.stop()
    }
  } catch {
    // ignore
  }

  try {
    Openwakeword.reset()
  } catch {
    // ignore
  }

  await nativeAudioCooldown(500)
}

export async function startOpenWakeWordListener(onDetected: () => void): Promise<void> {
  await ensureVoiceProcessorFullyStopped()

  const ready = await prepareOpenWakeWord()
  if (!ready) {
    throw new Error('openWakeWord-modellen laden mislukt.')
  }

  const vp = VoiceProcessor.instance
  if (!(await vp.hasRecordAudioPermission())) {
    throw new Error('Microfoon-toestemming is vereist voor Hey Jarvis.')
  }

  onDetectedHandler = onDetected
  listening = true
  attachFrameListener()

  try {
    await vp.start(FRAME_LENGTH, SAMPLE_RATE)
  } catch (err) {
    listening = false
    onDetectedHandler = null
    detachFrameListener()
    throw err
  }
}

export async function stopOpenWakeWordListener(): Promise<void> {
  await ensureVoiceProcessorFullyStopped()
}

/** Soft release: microfoon uit, modellen blijven in geheugen (geen tweede loadModels). */
export async function releaseOpenWakeWordListener(): Promise<void> {
  await ensureVoiceProcessorFullyStopped()
}

export function isOpenWakeWordListening(): boolean {
  return listening
}
