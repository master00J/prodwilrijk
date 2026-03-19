import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { day, bc_employee_id, web_employee_id } = body || {}

    if (!day) {
      return NextResponse.json({ success: false, error: 'day is verplicht' }, { status: 400 })
    }

    const safeBc = bc_employee_id !== undefined && bc_employee_id !== '' ? Number(bc_employee_id) : null
    const safeWeb = web_employee_id !== undefined && web_employee_id !== '' ? Number(web_employee_id) : null

    const { data: existing } = await supabaseAdmin
      .from('prepack_sessions')
      .select('id')
      .eq('day', day)
      .order('id', { ascending: false })
      .limit(1)

    if (existing && existing.length > 0) {
      const sid = existing[0].id
      const { error } = await supabaseAdmin
        .from('prepack_sessions')
        .update({ bc_employee_id: safeBc, web_employee_id: safeWeb })
        .eq('id', sid)
      if (error) return NextResponse.json({ success: false }, { status: 500 })
      return NextResponse.json({ success: true, session_id: sid, updated: true })
    }

    const { data, error } = await supabaseAdmin
      .from('prepack_sessions')
      .insert({ day, bc_employee_id: safeBc, web_employee_id: safeWeb })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false }, { status: 500 })
    return NextResponse.json({ success: true, session_id: data.id, created: true })
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
