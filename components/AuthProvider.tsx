'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isVerified: boolean
  allowedSites: string[]
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isVerified: false,
  allowedSites: [],
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

/** Pagina’s zonder auth-check (geen /pending-verification: die moet sessie kunnen valideren). */
const PUBLIC_SKIP_AUTH = ['/login', '/signup', '/tv-display']

const COOKIE_REFRESH_INTERVAL = 20 * 60 * 1000 // 20 min — HttpOnly-cookie JWT ~1u; marge vóór expiry

function isPublicSkipAuth(path: string): boolean {
  return PUBLIC_SKIP_AUTH.some((p) => path.startsWith(p))
}

function isPasswordRecoveryHash(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hash.includes('type=recovery')
}

function redirectToAccountForRecovery(
  router: ReturnType<typeof useRouter>,
  pathname: string
) {
  if (pathname === '/account') return
  const { search, hash } = window.location
  router.replace(`/account${search}${hash}`)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type MeStatus =
  | { kind: 'ok'; verified: boolean; isAdmin: boolean; mustChangePassword: boolean; allowedSites: string[] }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [allowedSites, setAllowedSites] = useState<string[]>([])
  const router = useRouter()
  const pathname = usePathname()
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  const syncSessionCookie = useCallback(async (accessToken: string | null) => {
    try {
      if (accessToken) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        })
      } else {
        await fetch('/api/auth/session', { method: 'DELETE' })
      }
    } catch {
      // Non-critical
    }
  }, [])

  const startCookieRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        syncSessionCookie(session.access_token)
      }
    }, COOKIE_REFRESH_INTERVAL)
  }, [syncSessionCookie])

  /**
   * /api/auth/me faalt vaak met 401 als de HttpOnly-cookie achterloopt op de Supabase-sessie in localStorage.
   * Dat mag niet als “niet geverifieerd” worden geïnterpreteerd (anders eindeloos pending-verification).
   */
  const checkUserStatus = useCallback(async (): Promise<MeStatus> => {
    const fetchMe = () =>
      fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      })

    try {
      let res = await fetchMe()
      if (res.status === 401) {
        const { data } = await supabase.auth.refreshSession()
        if (data.session?.access_token) {
          await syncSessionCookie(data.session.access_token)
          res = await fetchMe()
        }
      }
      for (let attempt = 0; attempt < 3 && !res.ok && res.status !== 401; attempt++) {
        await sleep(200 * (attempt + 1))
        res = await fetchMe()
      }
      if (res.status === 401) {
        return { kind: 'unauthenticated' }
      }
      if (!res.ok) {
        return { kind: 'error' }
      }
      const data = await res.json()
      return {
        kind: 'ok',
        verified: data.verified === true,
        isAdmin: data.isAdmin || false,
        mustChangePassword: data.must_change_password === true || data.mustChangePassword === true,
        allowedSites: Array.isArray(data.allowedSites) ? data.allowedSites : [],
      }
    } catch {
      return { kind: 'error' }
    }
  }, [syncSessionCookie])

  const clearAuthState = useCallback(async () => {
    await supabase.auth.signOut()
    await syncSessionCookie(null)
    setUser(null)
    setIsAdmin(false)
    setIsVerified(false)
    setAllowedSites([])
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
  }, [syncSessionCookie])

  const redirectUnauthenticated = useCallback(
    (path: string) => {
      if (path === '/pending-verification') {
        router.replace('/login')
      } else if (!isPublicSkipAuth(path)) {
        router.push(`/login?redirect=${encodeURIComponent(path)}`)
      }
    },
    [router]
  )

  const applyMeStatus = useCallback(
    async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>, path: string) => {
      const status = await checkUserStatus()

      if (status.kind === 'unauthenticated' || status.kind === 'error') {
        await clearAuthState()
        redirectUnauthenticated(path)
        return 'stop'
      }

      setIsAdmin(status.isAdmin)
      setIsVerified(status.verified)
      setAllowedSites(status.allowedSites)

      if (!status.verified) {
        await clearAuthState()
        if (path !== '/pending-verification') {
          router.push('/pending-verification')
        }
        return 'stop'
      }

      if (status.mustChangePassword && path !== '/account') {
        router.push('/account?reason=password-reset')
      }

      startCookieRefreshTimer()
      return 'ok'
    },
    [checkUserStatus, clearAuthState, redirectUnauthenticated, router, startCookieRefreshTimer]
  )

  useEffect(() => {
    if (isPasswordRecoveryHash()) {
      redirectToAccountForRecovery(router, pathname)
    }
  }, [router, pathname])

  useEffect(() => {
    if (isPublicSkipAuth(pathname)) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (isPasswordRecoveryHash() && pathname !== '/account') {
        redirectToAccountForRecovery(router, pathname)
        setLoading(false)
        return
      }

      setUser(session?.user ?? null)

      if (session?.user) {
        await syncSessionCookie(session.access_token)
        const outcome = await applyMeStatus(session, pathname)
        if (outcome === 'stop') {
          setLoading(false)
          return
        }
      } else {
        setIsAdmin(false)
        setIsVerified(false)
        setAllowedSites([])
      }

      setLoading(false)

      if (!session && !isPublicSkipAuth(pathname) && pathname !== '/pending-verification') {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        redirectToAccountForRecovery(router, pathname)
        return
      }

      setUser(session?.user ?? null)
      await syncSessionCookie(session?.access_token ?? null)

      if (session?.user) {
        const outcome = await applyMeStatus(session, pathname)
        if (outcome === 'stop') {
          return
        }
      } else {
        setIsAdmin(false)
        setIsVerified(false)
        setAllowedSites([])
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      }

      if (!session && !isPublicSkipAuth(pathname) && pathname !== '/pending-verification') {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      } else if (session && (pathname === '/login' || pathname === '/signup')) {
        router.push('/')
      }
    })

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.access_token) void syncSessionCookie(s.access_token)
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [router, pathname, syncSessionCookie, checkUserStatus, applyMeStatus, clearAuthState, redirectUnauthenticated, startCookieRefreshTimer])

  const signOut = async () => {
    await clearAuthState()
    router.push('/login')
  }

  if (loading && !isPublicSkipAuth(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isVerified, allowedSites, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
