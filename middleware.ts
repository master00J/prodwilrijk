import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, RATE_LIMITS, type RateLimitConfig } from '@/lib/api/rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/session',
  '/api/auth/create-user-role',
]

const PUBLIC_PAGES = ['/login', '/signup', '/pending-verification']

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.includes('/scan-label') || pathname.includes('/parse-pdf')) {
    return RATE_LIMITS.ai_scan
  }
  if (pathname.includes('/send-email') || pathname.includes('/send-pdf') || pathname.includes('/send-daily-order')) {
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip static files and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // --- API route protection ---
  if (pathname.startsWith('/api')) {
    // Allow public API routes without auth
    if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // Rate limiting (applied to all API routes)
    const ip = getClientIp(req)
    const rateLimitConfig = getRateLimitConfig(pathname)
    const rateLimitKey = `${ip}:${pathname.split('/').slice(0, 4).join('/')}`
    const rateResult = checkRateLimit(rateLimitKey, rateLimitConfig)

    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Te veel verzoeken. Probeer het later opnieuw.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateResult.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // Auth check: read HttpOnly cookie or Authorization header
    const cookieToken = req.cookies.get('sb-access-token')?.value
    const authHeader = req.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = cookieToken || bearerToken

    if (!token) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    // Validate the token with Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Ongeldige of verlopen sessie' },
        { status: 401 }
      )
    }

    // Inject user info into request headers for route handlers
    const response = NextResponse.next()
    response.headers.set('x-user-id', data.user.id)
    response.headers.set('x-user-email', data.user.email || '')
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining))

    return response
  }

  // --- Page protection (client-side handles redirect, but skip for public pages) ---
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
