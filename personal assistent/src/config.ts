export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://prodwilrijk.be').replace(/\/$/, '')

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const APP_NAME = 'Prodwilrijk Assistent'

/** Gratis AccessKey van https://console.picovoice.ai/ — vereist voor wake word "Jarvis". */
export const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || ''
