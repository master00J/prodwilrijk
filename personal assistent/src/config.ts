export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://prodwilrijk.be').replace(/\/$/, '')

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const APP_NAME = 'Prodwilrijk Assistent'

/** Gratis AccessKey van https://console.picovoice.ai/ — optioneel; standaard openWakeWord. */
export const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || ''

/** Zet op "true" om Picovoice te prefereren boven openWakeWord. */
export const USE_PICOVOICE_WAKE = process.env.EXPO_PUBLIC_USE_PICOVOICE_WAKE === 'true'

/** Detectiedrempel openWakeWord (0–1), default 0.5. */
export const OPENWAKEWORD_THRESHOLD = Math.min(
  Math.max(Number(process.env.EXPO_PUBLIC_OPENWAKEWORD_THRESHOLD) || 0.5, 0.2),
  0.9
)
