import { NextRequest, NextResponse } from 'next/server'

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
  allowedSites: string[] | null
}

/**
 * Extracts user info injected by middleware.
 */
export function getUserFromRequest(request: NextRequest): AuthenticatedUser | null {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role')
  const userSites = request.headers.get('x-user-sites')

  if (userId) {
    return {
      id: userId,
      email: userEmail || '',
      role: userRole || 'user',
      allowedSites: userSites ? userSites.split(',').map(site => site.trim()).filter(Boolean) : null,
    }
  }

  return null
}

export function canAccessSite(user: AuthenticatedUser, site: string): boolean {
  if (user.role === 'admin') return true
  if (!user.allowedSites || user.allowedSites.length === 0) return true
  return user.allowedSites.includes(site)
}

export function requireSiteAccess(request: NextRequest, site: string): NextResponse | null {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  if (!canAccessSite(user, site)) {
    return NextResponse.json(
      { error: `Geen toegang tot vestiging ${site}` },
      { status: 403 }
    )
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
 * Uses the role already validated and cached by middleware — no extra DB call.
 */
export function withAdmin(handler: AuthenticatedHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 })
    }

    return handler(request, user, context)
  }
}
