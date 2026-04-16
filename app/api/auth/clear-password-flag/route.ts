import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  await supabaseAdmin
    .from('user_roles')
    .update({ must_change_password: false })
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
