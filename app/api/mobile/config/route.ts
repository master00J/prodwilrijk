import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Publieke mobiele app-config (enkel public-safe Supabase anon key). */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const apiBase = (process.env.NEXT_PUBLIC_SITE_URL || 'https://prodwilrijk.be').replace(/\/$/, '')

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Mobiele config niet beschikbaar' }, { status: 503 })
  }

  const response = NextResponse.json({
    apiBase,
    supabaseUrl,
    supabaseAnonKey,
  })
  response.headers.set('Cache-Control', 'public, max-age=300')
  return response
}
