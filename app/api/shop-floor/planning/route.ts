import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const VALID_SHIFTS = new Set(['dag', 'vroeg', 'laat', 'nacht'])
const VALID_STATUSES = new Set(['planned', 'released', 'in_progress', 'done', 'cancelled'])
const DEFAULT_SITE = 'Wilrijk'

function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeEmployeeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

async function enrichPlanningRows(rows: any[]) {
  const machineIds = [...new Set(rows.map((row) => row.machine_id).filter(Boolean))]
  const employeeIds = [
    ...new Set(rows.flatMap((row) => Array.isArray(row.assigned_employee_ids) ? row.assigned_employee_ids : [])),
  ]

  const [machinesRes, employeesRes] = await Promise.all([
    machineIds.length > 0
      ? supabaseAdmin.from('machines').select('id, name, capacity, site').in('id', machineIds)
      : Promise.resolve({ data: [] as any[] }),
    employeeIds.length > 0
      ? supabaseAdmin.from('employees').select('id, name').in('id', employeeIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const machineMap = new Map((machinesRes.data || []).map((machine: any) => [machine.id, machine]))
  const employeeMap = new Map((employeesRes.data || []).map((employee: any) => [employee.id, employee.name]))

  return rows.map((row) => ({
    ...row,
    machine: row.machine_id ? machineMap.get(row.machine_id) || null : null,
    employees: (row.assigned_employee_ids || []).map((id: number) => ({
      id,
      name: employeeMap.get(id) || `Medewerker ${id}`,
    })),
  }))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || searchParams.get('date') || todayInput()
    const dateTo = searchParams.get('date_to') || dateFrom
    const site = searchParams.get('site') || DEFAULT_SITE

    let query = supabaseAdmin
      .from('production_planning_items')
      .select('*')
      .eq('site', site)
      .gte('planned_date', dateFrom)
      .lte('planned_date', dateTo)
      .order('planned_date', { ascending: true })
      .order('shift', { ascending: true })
      .order('created_at', { ascending: true })

    const machineId = searchParams.get('machine_id')
    if (machineId) query = query.eq('machine_id', Number(machineId))

    const status = searchParams.get('status')
    if (status && VALID_STATUSES.has(status)) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    const items = await enrichPlanningRows(data || [])
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Error loading production planning:', error)
    return NextResponse.json(
      { error: error.message || 'Planning laden mislukt' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const plannedDate = String(body.planned_date || '').slice(0, 10)
    const productionStep = String(body.production_step || '').trim()

    if (!plannedDate || !productionStep) {
      return NextResponse.json({ error: 'planned_date en production_step zijn verplicht' }, { status: 400 })
    }

    const shift = VALID_SHIFTS.has(body.shift) ? body.shift : 'dag'
    const status = VALID_STATUSES.has(body.status) ? body.status : 'planned'
    const lineId = body.production_order_line_id ? Number(body.production_order_line_id) : null
    const site = String(body.site || DEFAULT_SITE).trim() || DEFAULT_SITE

    let lineData: any = null
    let orderData: any = null
    if (lineId) {
      const { data: line, error: lineError } = await supabaseAdmin
        .from('production_order_lines')
        .select('id, production_order_id, item_number, item_no, description, description_2, quantity')
        .eq('id', lineId)
        .maybeSingle()
      if (lineError) throw lineError
      lineData = line
      if (line?.production_order_id) {
        const { data: order, error: orderError } = await supabaseAdmin
          .from('production_orders')
          .select('id, order_number, sales_order_number')
          .eq('id', line.production_order_id)
          .maybeSingle()
        if (orderError) throw orderError
        orderData = order
      }
    }

    const insert = {
      production_order_id: orderData?.id ?? body.production_order_id ?? null,
      production_order_line_id: lineData?.id ?? lineId,
      order_number: orderData?.order_number || String(body.order_number || '').trim(),
      sales_order_number: orderData?.sales_order_number ?? body.sales_order_number ?? null,
      item_number: lineData?.item_number || lineData?.item_no || body.item_number || null,
      description: lineData?.description || lineData?.description_2 || body.description || null,
      production_step: productionStep,
      site,
      planned_date: plannedDate,
      shift,
      machine_id: body.machine_id ? Number(body.machine_id) : null,
      assigned_employee_ids: normalizeEmployeeIds(body.assigned_employee_ids),
      planned_quantity: body.planned_quantity !== '' && body.planned_quantity != null ? Number(body.planned_quantity) : null,
      planned_minutes: body.planned_minutes !== '' && body.planned_minutes != null ? Math.max(0, Math.floor(Number(body.planned_minutes))) : null,
      status,
      notes: body.notes?.trim() || null,
      updated_by: request.headers.get('x-user-email') || null,
    }

    if (!insert.order_number) {
      return NextResponse.json({ error: 'order_number ontbreekt' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('production_planning_items')
      .insert(insert)
      .select()
      .single()

    if (error) throw error
    const [item] = await enrichPlanningRows([data])
    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    console.error('Error creating production planning item:', error)
    return NextResponse.json(
      { error: error.message || 'Planning opslaan mislukt' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.planned_date !== undefined) updates.planned_date = String(body.planned_date).slice(0, 10)
    if (body.site !== undefined) updates.site = String(body.site || DEFAULT_SITE).trim() || DEFAULT_SITE
    if (body.shift !== undefined && VALID_SHIFTS.has(body.shift)) updates.shift = body.shift
    if (body.production_step !== undefined) updates.production_step = String(body.production_step).trim()
    if (body.machine_id !== undefined) updates.machine_id = body.machine_id ? Number(body.machine_id) : null
    if (body.assigned_employee_ids !== undefined) updates.assigned_employee_ids = normalizeEmployeeIds(body.assigned_employee_ids)
    if (body.planned_quantity !== undefined) updates.planned_quantity = body.planned_quantity === '' || body.planned_quantity == null ? null : Number(body.planned_quantity)
    if (body.planned_minutes !== undefined) updates.planned_minutes = body.planned_minutes === '' || body.planned_minutes == null ? null : Math.max(0, Math.floor(Number(body.planned_minutes)))
    if (body.status !== undefined && VALID_STATUSES.has(body.status)) updates.status = body.status
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
    updates.updated_by = request.headers.get('x-user-email') || null

    const { data, error } = await supabaseAdmin
      .from('production_planning_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    const [item] = await enrichPlanningRows([data])
    return NextResponse.json(item)
  } catch (error: any) {
    console.error('Error updating production planning item:', error)
    return NextResponse.json(
      { error: error.message || 'Planning aanpassen mislukt' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('production_planning_items')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting production planning item:', error)
    return NextResponse.json(
      { error: error.message || 'Planning verwijderen mislukt' },
      { status: 500 }
    )
  }
}
