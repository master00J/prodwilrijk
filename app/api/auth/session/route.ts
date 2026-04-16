import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sessionTokenSchema, validateBody, isErrorResponse } from '@/lib/api/validation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const COOKIE_NAME = 'sb-access-token'
const COOKIE_MAX_AGE = 60 * 60

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, sessionTokenSchema)
    if (isErrorResponse(parsed)) return parsed

    const { access_token } = parsed

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.auth.getUser(access_token)
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })

    response.cookies.set(COOKIE_NAME, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
