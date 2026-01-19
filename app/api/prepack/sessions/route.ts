import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const day = searchParams.get('day') || ''

    let query = supabaseAdmin
      .from('prepack_sessions')
      .select('id, day, label, bc_employee_id, web_employee_id, started_at, ended_at')
      .order('id', { ascending: false })
      .limit(200)

    if (day) query = query.eq('day', day)

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false }, { status: 500 })

    return NextResponse.json({ success: true, sessions: data || [] })
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
