import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

/**
 * POST: bulk-create "aanwezig" entries for all active employees
 * that don't have a status for the given date yet.
 * Returns all statuses for the date afterwards.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { date } = body

  if (!date) {
    return NextResponse.json({ error: 'date is verplicht' }, { status: 400 })
  }

  const [employeesRes, existingRes] = await Promise.all([
    supabaseAdmin.from('employees').select('id').eq('active', true),
    supabaseAdmin
      .from('employee_daily_status')
      .select('employee_id')
      .eq('date', date),
  ])

  if (employeesRes.error)
    return NextResponse.json({ error: employeesRes.error.message }, { status: 500 })
  if (existingRes.error)
    return NextResponse.json({ error: existingRes.error.message }, { status: 500 })

  const existingIds = new Set(existingRes.data.map((r) => r.employee_id))
  const missing = employeesRes.data.filter((e) => !existingIds.has(e.id))

  if (missing.length > 0) {
    const rows = missing.map((e) => ({
      employee_id: e.id,
      date,
      status: 'aanwezig',
      shift: 'dag',
      assigned_machine_id: null,
      notes: null,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('employee_daily_status')
      .insert(rows)

    if (insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('employee_daily_status')
    .select('id, employee_id, date, status, shift, assigned_machine_id, notes')
    .eq('date', date)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
