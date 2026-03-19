import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

// GET: historiek voor een medewerker of machine (laatste 50)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const machineId  = searchParams.get('machine_id')

  let query = supabaseAdmin
    .from('competency_history')
    .select('id, employee_id, machine_id, old_level, new_level, changed_at')
    .order('changed_at', { ascending: false })
    .limit(50)

  if (employeeId) query = query.eq('employee_id', employeeId)
  if (machineId)  query = query.eq('machine_id',  machineId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: voeg een historiek-entry toe
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { employee_id, machine_id, old_level, new_level } = body

  if (!employee_id || !machine_id || new_level === undefined) {
    return NextResponse.json({ error: 'employee_id, machine_id en new_level zijn verplicht' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('competency_history')
    .insert({ employee_id, machine_id, old_level: old_level ?? 0, new_level })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
