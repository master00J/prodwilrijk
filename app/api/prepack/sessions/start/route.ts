import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label, bc_employee_id, web_employee_id } = body || {}
    const now = new Date()
    const day = now.toISOString().slice(0, 10)

    const { data, error } = await supabaseAdmin
      .from('prepack_sessions')
      .insert({
        day,
        label: label || null,
        bc_employee_id: bc_employee_id || null,
        web_employee_id: web_employee_id || null,
        started_at: now.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: 'DB' }, { status: 500 })
    }

    return NextResponse.json({ success: true, session_id: data.id, day })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Serverfout' }, { status: 500 })
  }
}
