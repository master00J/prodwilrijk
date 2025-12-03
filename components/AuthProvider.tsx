'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await checkAdminStatus(session.user.id)
      } else {
        setIsAdmin(false)
      }
      
      setLoading(false)

      // Redirect to login if not authenticated and not on login/signup page
      if (!session && !pathname.startsWith('/login') && !pathname.startsWith('/signup')) {
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
        await checkAdminStatus(session.user.id)
      } else {
        setIsAdmin(false)
      }
      
      if (!session && !pathname.startsWith('/login') && !pathname.startsWith('/signup')) {
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`
        router.push(redirectUrl)
      } else if (session && (pathname === '/login' || pathname === '/signup')) {
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
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

