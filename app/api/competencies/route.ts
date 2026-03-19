import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

// GET: all competencies (optionally filtered by employee or machine)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const machineId = searchParams.get('machine_id')

  let query = supabaseAdmin
    .from('competencies')
    .select('id, employee_id, machine_id, level, notes, updated_at')

  if (employeeId) query = query.eq('employee_id', employeeId)
  if (machineId) query = query.eq('machine_id', machineId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST or upsert a competency
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { employee_id, machine_id, level, notes } = body

  if (!employee_id || !machine_id) {
    return NextResponse.json({ error: 'employee_id en machine_id zijn verplicht' }, { status: 400 })
  }
  if (level < 0 || level > 4) {
    return NextResponse.json({ error: 'Level moet tussen 0 en 4 liggen' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('competencies')
    .upsert(
      {
        employee_id,
        machine_id,
        level: level ?? 0,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,machine_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE a competency
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

  const { error } = await supabaseAdmin.from('competencies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
