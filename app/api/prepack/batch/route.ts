import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Entry = {
  ts?: string
  code: string
  location?: string
  note?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entries: Entry[] = Array.isArray(body?.entries) ? body.entries : []
    const employeeId = body?.employee_id ?? null
    const sessionId = body?.session_id ?? null

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Geen entries' }, { status: 400 })
    }

    const rows = entries.map((e) => ({
      ts: e.ts || null,
      code: String(e.code || '').trim(),
      location: e.location || null,
      note: e.note || null,
      employee_id: employeeId ? Number(employeeId) : null,
      session_id: sessionId ? Number(sessionId) : null,
      created_at: new Date().toISOString(),
    })).filter((r) => r.code)

    const { error } = await supabaseAdmin.from('prepack_scans').insert(rows)
    if (error) {
      console.error('prepack/batch insert error:', error)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true, inserted: rows.length })
  } catch (error) {
    console.error('prepack/batch error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
