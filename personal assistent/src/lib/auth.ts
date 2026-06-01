import { createClient, type Session } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { API_BASE, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config'

const SESSION_KEY = 'prodwilrijk_assistant_session'

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: secureStoreAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null

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
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd. Vul EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY in.')
  }

  const email = await resolveLoginEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(error?.message || 'Ongeldige login')
  }

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.session))
  return data.session
}

export async function restoreSession(): Promise<Session | null> {
  if (!supabase) return null

  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const raw = await SecureStore.getItemAsync(SESSION_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    const { data: refreshed, error } = await supabase.auth.setSession({
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
