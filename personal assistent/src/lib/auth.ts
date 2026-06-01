import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { API_BASE, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config'

const SESSION_KEY = 'prodwilrijk_assistant_session'

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

let supabase: SupabaseClient | null = null

async function createSupabaseClient(): Promise<SupabaseClient> {
  if (supabase) return supabase

  let url = SUPABASE_URL
  let anonKey = SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    const response = await fetch(`${API_BASE}/api/mobile/config`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || 'Mobiele config ophalen mislukt')
    }
    url = payload.supabaseUrl
    anonKey = payload.supabaseAnonKey
  }

  if (!url || !anonKey) {
    throw new Error('Supabase is niet geconfigureerd voor de mobiele app.')
  }

  supabase = createClient(url, anonKey, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })

  return supabase
}

export async function resolveLoginEmail(username: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Login mislukt')
  }

  return payload.email as string
}

export async function signIn(username: string, password: string): Promise<Session> {
  const client = await createSupabaseClient()
  const email = await resolveLoginEmail(username)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(error?.message || 'Ongeldige login')
  }

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.session))
  return data.session
}

export async function restoreSession(): Promise<Session | null> {
  const client = await createSupabaseClient()
  const { data } = await client.auth.getSession()
  if (data.session) return data.session

  const raw = await SecureStore.getItemAsync(SESSION_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    const { data: refreshed, error } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error || !refreshed.session) {
      await SecureStore.deleteItemAsync(SESSION_KEY)
      return null
    }
    return refreshed.session
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY)
    return null
  }
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut()
  }
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

export async function getAccessToken(): Promise<string | null> {
  const session = await restoreSession()
  return session?.access_token ?? null
}
