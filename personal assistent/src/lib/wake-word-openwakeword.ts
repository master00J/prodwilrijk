import * as FileSystem from 'expo-file-system'
import { VoiceProcessor } from '@picovoice/react-native-voice-processor'
import { Openwakeword } from 'react-native-openwakeword'
import { OPENWAKEWORD_THRESHOLD, USE_PICOVOICE_WAKE } from '@/config'

const MODEL_RELEASE = 'https://github.com/dscripka/openWakeWord/releases/download/v0.5.1'
const MODEL_FILES = [
  'melspectrogram.tflite',
  'embedding_model.tflite',
  'hey_jarvis_v0.1.tflite',
] as const

const FRAME_LENGTH = 1280
const SAMPLE_RATE = 16000

let modelsReady = false
let prepareInFlight: Promise<boolean> | null = null
let listening = false
let onDetectedHandler: (() => void) | null = null
let lastTriggerAt = 0
const COOLDOWN_MS = 3500

let frameListener: ((frame: number[]) => void) | null = null

export function isOpenWakeWordPreferred(): boolean {
  if (USE_PICOVOICE_WAKE) return false
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

async function prepareOpenWakeWordOnce(): Promise<boolean> {
  if (!isOpenWakeWordPreferred()) return false
  if (modelsReady) return true

  try {
    const paths = await downloadModelsIfNeeded()
    const loaded = Openwakeword.loadModels(paths.mel, paths.embedding, paths.wake)
    if (!loaded) return false
    Openwakeword.setThreshold(OPENWAKEWORD_THRESHOLD)
    Openwakeword.reset()
    modelsReady = true
    return true
  } catch (err) {
    console.warn('[openwakeword] init', err instanceof Error ? err.message : err)
    modelsReady = false
    return false
  }
}

/** Eén gelijktijdige init — dubbele loadModels crashte de app bij opstart. */
export async function prepareOpenWakeWord(): Promise<boolean> {
  if (!isOpenWakeWordPreferred()) return false
  if (modelsReady) return true
  if (prepareInFlight) return prepareInFlight
  prepareInFlight = prepareOpenWakeWordOnce().finally(() => {
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

function attachFrameListener() {
  const vp = VoiceProcessor.instance
  if (frameListener) {
    vp.removeFrameListener(frameListener)
  }
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

export async function startOpenWakeWordListener(onDetected: () => void): Promise<void> {
  if (listening) {
    onDetectedHandler = onDetected
    return
  }

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
  Openwakeword.reset()
  attachFrameListener()

  try {
    const recording = await vp.isRecording()
    if (!recording) {
      await vp.start(FRAME_LENGTH, SAMPLE_RATE)
    }
  } catch (err) {
    listening = false
    onDetectedHandler = null
    if (frameListener) {
      vp.removeFrameListener(frameListener)
      frameListener = null
    }
    throw err
  }
}

export async function stopOpenWakeWordListener(): Promise<void> {
  listening = false
  onDetectedHandler = null
  const vp = VoiceProcessor.instance
  if (frameListener) {
    vp.removeFrameListener(frameListener)
    frameListener = null
  }
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
}

export async function releaseOpenWakeWordListener(): Promise<void> {
  await stopOpenWakeWordListener()
  modelsReady = false
}

export function isOpenWakeWordListening(): boolean {
  return listening
}
