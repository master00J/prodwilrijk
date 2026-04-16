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
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isVerified: false,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

const COOKIE_REFRESH_INTERVAL = 50 * 60 * 1000 // 50 minutes

const PUBLIC_PATHS = ['/login', '/signup', '/pending-verification', '/tv-display']

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(p => path.startsWith(p))
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
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
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        syncSessionCookie(session.access_token)
      }
    }, COOKIE_REFRESH_INTERVAL)
  }, [syncSessionCookie])

  const checkUserStatus = useCallback(async (): Promise<{ isAdmin: boolean; verified: boolean }> => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        return { isAdmin: data.isAdmin || false, verified: data.verified || false }
      }
    } catch {
      // Fall through
    }
    return { isAdmin: false, verified: false }
  }, [])

  useEffect(() => {
    // TV display pages don't need auth
    if (isPublicPath(pathname)) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        await syncSessionCookie(session.access_token)

        const status = await checkUserStatus()
        setIsAdmin(status.isAdmin)
        setIsVerified(status.verified)

        if (!status.verified) {
          await supabase.auth.signOut()
          await syncSessionCookie(null)
          setUser(null)
          setIsAdmin(false)
          setIsVerified(false)
          if (pathname !== '/pending-verification') {
            router.push('/pending-verification')
          }
          setLoading(false)
          return
        }

        startCookieRefreshTimer()
      } else {
        setIsAdmin(false)
        setIsVerified(false)
      }

      setLoading(false)

      if (!session && !isPublicPath(pathname)) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      await syncSessionCookie(session?.access_token ?? null)

      if (session?.user) {
        const status = await checkUserStatus()
        setIsAdmin(status.isAdmin)
        setIsVerified(status.verified)

        if (!status.verified) {
          await supabase.auth.signOut()
          await syncSessionCookie(null)
          setUser(null)
          setIsAdmin(false)
          setIsVerified(false)
          if (pathname !== '/pending-verification') {
            router.push('/pending-verification')
          }
          return
        }

        startCookieRefreshTimer()
      } else {
        setIsAdmin(false)
        setIsVerified(false)
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      }

      if (!session && !isPublicPath(pathname)) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      } else if (session && (pathname === '/login' || pathname === '/signup')) {
        router.push('/')
      }
    })

    return () => {
      subscription.unsubscribe()
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [router, pathname, syncSessionCookie, checkUserStatus, startCookieRefreshTimer])

  const signOut = async () => {
    await supabase.auth.signOut()
    await syncSessionCookie(null)
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    setUser(null)
    setIsAdmin(false)
    router.push('/login')
  }

  if (loading && !isPublicPath(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isVerified, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
