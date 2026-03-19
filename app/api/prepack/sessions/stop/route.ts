import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body || {}
    if (!session_id) {
      return NextResponse.json({ success: false, error: 'session_id vereist' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('prepack_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', Number(session_id))

    if (error) {
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
