import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const machineId  = searchParams.get('machine_id')
  const completed  = searchParams.get('completed')

  let query = supabaseAdmin
    .from('training_plans')
    .select('id, employee_id, machine_id, target_date, trainer_id, notes, completed, created_at, updated_at')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (employeeId) query = query.eq('employee_id', employeeId)
  if (machineId)  query = query.eq('machine_id',  machineId)
  if (completed !== null) query = query.eq('completed', completed === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { employee_id, machine_id, target_date, trainer_id, notes, completed } = body

  if (!employee_id || !machine_id) {
    return NextResponse.json({ error: 'employee_id en machine_id zijn verplicht' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('training_plans')
    .insert({
      employee_id,
      machine_id,
      target_date: target_date || null,
      trainer_id:  trainer_id  || null,
      notes:       notes?.trim() || null,
      completed:   completed ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { id, target_date, trainer_id, notes, completed } = body

  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (target_date !== undefined) updates.target_date = target_date || null
  if (trainer_id  !== undefined) updates.trainer_id  = trainer_id  || null
  if (notes       !== undefined) updates.notes       = notes?.trim() || null
  if (completed   !== undefined) updates.completed   = completed

  const { data, error } = await supabaseAdmin
    .from('training_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

  const { error } = await supabaseAdmin.from('training_plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
