import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Controleert of het request een geldig Supabase access-token bevat.
 * Geeft { user } terug bij succes, of een NextResponse 401 bij falen.
 *
 * Gebruik:
 *   const authResult = await requireAuth(request)
 *   if (authResult instanceof NextResponse) return authResult
 *   const { user } = authResult
 */
export async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return NextResponse.json({ error: 'Ongeldige sessie' }, { status: 401 })
  }

  return { user: data.user }
}
