import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

// GET: daily statuses for a date (defaults to today)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('employee_daily_status')
    .select('id, employee_id, date, status, assigned_machine_id, notes')
    .eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST/upsert a daily status for one employee
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { employee_id, date, status, assigned_machine_id, notes } = body

  if (!employee_id || !date) {
    return NextResponse.json({ error: 'employee_id en date zijn verplicht' }, { status: 400 })
  }

  const validStatuses = ['aanwezig', 'afwezig', 'verlof', 'ziek', 'thuiswerk']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Ongeldig status' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('employee_daily_status')
    .upsert(
      {
        employee_id,
        date,
        status: status ?? 'aanwezig',
        assigned_machine_id: assigned_machine_id ?? null,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: remove a daily status entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

  const { error } = await supabaseAdmin.from('employee_daily_status').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
