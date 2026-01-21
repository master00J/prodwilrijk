import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('heftruck_water_log')
      .select('id, employee_id, heftruck, filled_at, note, created_at, employees(name)')
      .order('filled_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Error fetching heftruck water log:', error)
      return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 })
    }

    const items = (data || []).map((row: any) => ({
      ...row,
      employee_name: row.employees?.name || null,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const employeeId = body.employee_id ? Number(body.employee_id) : null
    const heftruck = String(body.heftruck || '').trim()
    const filledAt = body.filled_at ? new Date(body.filled_at).toISOString() : null
    const note = body.note ? String(body.note).trim() : null

    if (!heftruck || !filledAt) {
      return NextResponse.json({ error: 'Heftruck en datum/tijd zijn verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('heftruck_water_log')
      .insert({
        employee_id: employeeId,
        heftruck,
        filled_at: filledAt,
        note,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving heftruck water log:', error)
      return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
