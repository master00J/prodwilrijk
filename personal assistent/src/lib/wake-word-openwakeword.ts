import { Buffer } from 'buffer'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import LiveAudioStream from 'react-native-live-audio-stream'
import { Openwakeword } from 'react-native-openwakeword'
import { OPENWAKEWORD_THRESHOLD, USE_PICOVOICE_WAKE } from '@/config'

const MODEL_RELEASE = 'https://github.com/dscripka/openWakeWord/releases/download/v0.5.1'
const MODEL_FILES = [
  'melspectrogram.tflite',
  'embedding_model.tflite',
  'hey_jarvis_v0.1.tflite',
] as const

function modelDir(): string {
  const base = FileSystem.documentDirectory
  if (!base) throw new Error('App-opslag niet beschikbaar.')
  return `${base}openwakeword/`
}

let modelsReady = false
let listening = false
let onDetectedHandler: (() => void) | null = null
let lastTriggerAt = 0
const COOLDOWN_MS = 3500

export function isOpenWakeWordPreferred(): boolean {
  if (USE_PICOVOICE_WAKE) return false
  return Platform.OS === 'android' || Platform.OS === 'ios'
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

export async function prepareOpenWakeWord(): Promise<boolean> {
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

function onAudioData(base64Chunk: string) {
  if (!listening || !onDetectedHandler) return
  try {
    const chunk = Buffer.from(base64Chunk, 'base64')
    const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
    const result = Openwakeword.processFrame(buffer)
    if (!result.isDetected) return
    const now = Date.now()
    if (now - lastTriggerAt < COOLDOWN_MS) return
    lastTriggerAt = now
    onDetectedHandler()
  } catch {
    // frame overslaan
  }
}

export async function startOpenWakeWordListener(onDetected: () => void): Promise<void> {
  const ready = await prepareOpenWakeWord()
  if (!ready) {
    throw new Error('openWakeWord-modellen laden mislukt.')
  }

  onDetectedHandler = onDetected
  listening = true
  Openwakeword.reset()

  const base = FileSystem.documentDirectory || ''
  LiveAudioStream.on('data', onAudioData)
  LiveAudioStream.init({
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    bufferSize: 4096,
    audioSource: 6,
    wavFile: `${base}openwakeword_mic.wav`,
  })
  LiveAudioStream.start()
}

export async function stopOpenWakeWordListener(): Promise<void> {
  listening = false
  onDetectedHandler = null
  try {
    LiveAudioStream.stop()
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
