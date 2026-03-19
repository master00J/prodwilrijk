'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const checkAdminStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/check-admin?userId=${encodeURIComponent(userId)}`)
      if (response.ok) {
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  const checkVerificationStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/check-verified?userId=${encodeURIComponent(userId)}`)
      if (response.ok) {
        const data = await response.json()
        setIsVerified(data.verified || false)
      } else {
        setIsVerified(false)
      }
    } catch (error) {
      console.error('Error checking verification status:', error)
      setIsVerified(false)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const [adminResult, verifiedResult] = await Promise.all([
          checkAdminStatus(session.user.id),
          checkVerificationStatus(session.user.id)
        ])
        
        // Check verification status directly
        const verifiedResponse = await fetch(`/api/auth/check-verified?userId=${encodeURIComponent(session.user.id)}`)
        let userVerified = false
        if (verifiedResponse.ok) {
          const verifiedData = await verifiedResponse.json()
          userVerified = verifiedData.verified || false
        }
        
        // If not verified, sign out and redirect
        if (!userVerified) {
          await supabase.auth.signOut()
          setUser(null)
          setIsAdmin(false)
          setIsVerified(false)
          if (pathname !== '/pending-verification') {
            router.push('/pending-verification')
          }
          return
        }
      } else {
        setIsAdmin(false)
        setIsVerified(false)
      }
      
      setLoading(false)

      // Redirect to login if not authenticated and not on login/signup/pending page
      if (
        !session &&
        !pathname.startsWith('/login') &&
        !pathname.startsWith('/signup') &&
        !pathname.startsWith('/pending-verification')
      ) {
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`
        router.push(redirectUrl)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await Promise.all([
          checkAdminStatus(session.user.id),
          checkVerificationStatus(session.user.id)
        ])
        
        // Check verification status directly
        const verifiedResponse = await fetch(`/api/auth/check-verified?userId=${encodeURIComponent(session.user.id)}`)
        let userVerified = false
        if (verifiedResponse.ok) {
          const verifiedData = await verifiedResponse.json()
          userVerified = verifiedData.verified || false
        }
        
        // If not verified, sign out and redirect
        if (!userVerified) {
          await supabase.auth.signOut()
          setUser(null)
          setIsAdmin(false)
          setIsVerified(false)
          if (pathname !== '/pending-verification') {
            router.push('/pending-verification')
          }
          return
        }
      } else {
        setIsAdmin(false)
        setIsVerified(false)
      }
      
      if (
        !session &&
        !pathname.startsWith('/login') &&
        !pathname.startsWith('/signup') &&
        !pathname.startsWith('/pending-verification')
      ) {
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`
        router.push(redirectUrl)
      } else if (session && (pathname === '/login' || pathname === '/signup')) {
        // Check verification before redirecting
        if (session.user) {
          const verifiedResponse = await fetch(`/api/auth/check-verified?userId=${encodeURIComponent(session.user.id)}`)
          if (verifiedResponse.ok) {
            const verifiedData = await verifiedResponse.json()
            if (!verifiedData.verified) {
              await supabase.auth.signOut()
              setUser(null)
              setIsAdmin(false)
              setIsVerified(false)
              router.push('/pending-verification')
              return
            }
          }
        }
        router.push('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    router.push('/login')
  }

  // Don't render children if loading and not on login/signup page
  if (loading && !pathname.startsWith('/login') && !pathname.startsWith('/signup')) {
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

