import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, RATE_LIMITS, type RateLimitConfig } from '@/lib/api/rate-limit'
import { getCachedStatus, setCachedStatus } from '@/lib/api/user-status-cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const ALLOWED_ORIGINS = [
  'https://prodwilrijk.be',
  'https://www.prodwilrijk.be',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter(Boolean) as string[]

const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/session',
  '/api/auth/create-user-role',
  '/api/tv-slides/production-status',
  '/api/tv-slides/packing-stats',
  '/api/tv-slides/transport-planning',
  '/api/tv-slides/priorities',
  '/api/tv-slides/weather',
  '/api/tv-slides/dagplanning',
  '/api/packed-items-airtec/send-daily-report',
  // Publiek leesbare vertaaltabel (oud ↔ nieuw BC item nr).
  // Bevat geen gevoelige data; handig voor lokale scripts/BC36-filters.
  '/api/bc-mappings',
]

function isPublicRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/tv-screens') && method === 'GET') return true
  if (pathname.includes('/heartbeat') && pathname.startsWith('/api/tv-screens') && method === 'POST') return true
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) return true
  // /api/tv-slides exact match (GET) or with query params, but NOT /api/tv-slides/upload-image
  if (pathname === '/api/tv-slides') return true
  return false
}

const PUBLIC_PAGES = ['/login', '/signup', '/pending-verification']

// User status cache is in lib/api/user-status-cache.ts (shared with admin routes for invalidation)

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.startsWith('/api/ai/chat')) {
    return RATE_LIMITS.ai_chat
  }
  if (pathname.includes('/scan-label') || pathname.includes('/parse-pdf')) {
    return RATE_LIMITS.ai_scan
  }
  if (pathname.includes('/send-email') || pathname.includes('/send-pdf') || pathname.includes('/send-daily-order') || pathname.includes('/send-daily-report')) {
    return RATE_LIMITS.email
  }
  if (pathname.startsWith('/api/auth/')) {
    return RATE_LIMITS.auth
  }
  if (pathname.startsWith('/api/admin/')) {
    return RATE_LIMITS.admin_write
  }
  return RATE_LIMITS.general
}

function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const isAllowed = !origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))

  if (origin && isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get('origin')

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS' && pathname.startsWith('/api')) {
    const preflightResponse = new NextResponse(null, { status: 204 })
    return addCorsHeaders(preflightResponse, origin)
  }

  // --- API route protection ---
  if (pathname.startsWith('/api')) {
    const isPublic = isPublicRoute(pathname, req.method)

    // Rate limiting (applied to all API routes, including public)
    const ip = getClientIp(req)
    const rateLimitConfig = getRateLimitConfig(pathname)
    const rateLimitKey = `${ip}:${pathname.split('/').slice(0, 4).join('/')}`
    const rateResult = checkRateLimit(rateLimitKey, rateLimitConfig)

    if (!rateResult.allowed) {
      const rateLimitResponse = NextResponse.json(
        { error: 'Te veel verzoeken. Probeer het later opnieuw.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateResult.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
      return addCorsHeaders(rateLimitResponse, origin)
    }

    // Public routes: allow without auth, still apply rate limiting
    if (isPublic) {
      const pubResponse = NextResponse.next()
      pubResponse.headers.set('X-RateLimit-Remaining', String(rateResult.remaining))
      return addCorsHeaders(pubResponse, origin)
    }

    // Auth check: read HttpOnly cookie or Authorization header
    const cookieToken = req.cookies.get('sb-access-token')?.value
    const authHeader = req.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = cookieToken || bearerToken

    if (!token) {
      const noAuthResponse = NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
      return addCorsHeaders(noAuthResponse, origin)
    }

    // Validate the token with Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      const invalidResponse = NextResponse.json(
        { error: 'Ongeldige of verlopen sessie' },
        { status: 401 }
      )
      return addCorsHeaders(invalidResponse, origin)
    }

    // Session invalidation: check verified/role status with cache
    const userId = data.user.id
    let userStatus = getCachedStatus(userId)

    if (!userStatus) {
      const adminClient = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('verified, role, allowed_sites')
        .eq('user_id', userId)
        .maybeSingle()

      userStatus = {
        verified: roleData?.verified === true,
        role: roleData?.role || 'user',
        allowedSites: Array.isArray(roleData?.allowed_sites) ? roleData.allowed_sites : null,
      }
      setCachedStatus(userId, userStatus)
    }

    // Auth routes (/api/auth/*) skip the verified check —
    // they're part of the auth flow and need to report status to unverified users
    if (!userStatus.verified && !pathname.startsWith('/api/auth/')) {
      const unverifiedResponse = NextResponse.json(
        { error: 'Account niet geverifieerd' },
        { status: 403 }
      )
      return addCorsHeaders(unverifiedResponse, origin)
    }

    // Inject user info into request headers for route handlers
    const response = NextResponse.next()
    response.headers.set('x-user-id', data.user.id)
    response.headers.set('x-user-email', data.user.email || '')
    response.headers.set('x-user-role', userStatus.role)
    if (userStatus.allowedSites) {
      response.headers.set('x-user-sites', userStatus.allowedSites.join(','))
    }
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining))

    return addCorsHeaders(response, origin)
  }

  // --- Page protection ---
  if (PUBLIC_PAGES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
