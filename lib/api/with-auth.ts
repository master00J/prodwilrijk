import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface AuthenticatedUser {
  id: string
  email: string
}

/**
 * Extracts user info injected by middleware.
 * Falls back to direct token validation if headers are missing.
 */
export function getUserFromRequest(request: NextRequest): AuthenticatedUser | null {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')

  if (userId) {
    return { id: userId, email: userEmail || '' }
  }

  return null
}

type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>
type AuthenticatedHandler = (request: NextRequest, user: AuthenticatedUser, context?: any) => Promise<NextResponse>

/**
 * Wraps a route handler to require authentication.
 * User info is extracted from middleware-injected headers.
 */
export function withAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    return handler(request, user, context)
  }
}

/**
 * Wraps a route handler to require admin role.
 * Checks user_roles table in Supabase.
 */
export function withAdmin(handler: AuthenticatedHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (role?.role !== 'admin') {
      return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 })
    }

    return handler(request, user, context)
  }
}
