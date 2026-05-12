import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_number, line_id, tv_priority } = body
    const site = normalizeSite(body.site)

    if (tv_priority === undefined) {
      return NextResponse.json({ error: 'tv_priority is verplicht' }, { status: 400 })
    }

    if (line_id) {
      const { data: line, error: lineError } = await supabaseAdmin
        .from('production_order_lines')
        .select('id, production_order_id, production_orders!inner(site)')
        .eq('id', Number(line_id))
        .eq('production_orders.site', site)
        .maybeSingle()

      if (lineError) throw lineError
      if (!line?.id) {
        return NextResponse.json({ error: 'Orderlijn niet gevonden voor deze vestiging' }, { status: 404 })
      }

      const { error } = await supabaseAdmin
        .from('production_order_lines')
        .update({ tv_priority: Number(tv_priority) })
        .eq('id', Number(line_id))

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (!order_number) {
      return NextResponse.json({ error: 'order_number of line_id is verplicht' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('production_orders')
      .update({ tv_priority: Number(tv_priority) })
      .eq('order_number', order_number)
      .eq('site', site)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const site = normalizeSite(request.nextUrl.searchParams.get('site'))
    // Actieve orders (niet afgewerkt, voor tijdregistratie)
    const { data: orders } = await supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, creation_date, due_date, starting_date, finished_at, tv_priority, site')
      .eq('for_time_registration', true)
      .eq('site', site)
      .is('finished_at', null)
      .order('creation_date', { ascending: true })

    // Actieve time logs (lopende timers)
    const { data: activeLogs } = await supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, production_order_number, production_item_number, production_step')
      .is('end_time', null)
      .eq('type', 'production_order')
      .eq('site', site)

    // Medewerker-namen
    const employeeIds = [...new Set((activeLogs || []).map((l: any) => l.employee_id))]
    let employeeMap = new Map<number, string>()
    if (employeeIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from('employees')
        .select('id, name')
        .in('id', employeeIds)
      ;(employees || []).forEach((e: any) => employeeMap.set(e.id, e.name))
    }

    // Orderlijnen voor actieve orders
    const orderIds = (orders || []).map((o: any) => o.id)
    const orderIdToNumber = new Map((orders || []).map((o: any) => [o.id, o.order_number]))
    let linesMap = new Map<string, any[]>()
    if (orderIds.length > 0) {
      const { data: lines } = await supabaseAdmin
        .from('production_order_lines')
        .select('id, production_order_id, line_no, item_number, description, quantity, tv_priority')
        .in('production_order_id', orderIds)
        .order('line_no', { ascending: true })
      ;(lines || []).forEach((l: any) => {
        const orderNumber = orderIdToNumber.get(l.production_order_id)
        if (!orderNumber) return
        const arr = linesMap.get(orderNumber) || []
        arr.push(l)
        linesMap.set(orderNumber, arr)
      })
    }

    // Bouw resultaat per order
    const activeLogsByOrder = new Map<string, any[]>()
    ;(activeLogs || []).forEach((log: any) => {
      const on = log.production_order_number
      if (!on) return
      const arr = activeLogsByOrder.get(on) || []
      arr.push({
        ...log,
        employee_name: employeeMap.get(log.employee_id) || `Medewerker ${log.employee_id}`,
        elapsed_seconds: Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000),
      })
      activeLogsByOrder.set(on, arr)
    })

    const result = (orders || []).map((order: any) => {
      const logs = activeLogsByOrder.get(order.order_number) || []
      const lines = linesMap.get(order.order_number) || []

      const descMap = new Map<string, string>()
      lines.forEach((l: any) => {
        if (l.item_number && l.description) descMap.set(l.item_number, l.description)
      })

      return {
        order_number: order.order_number,
        sales_order_number: order.sales_order_number,
        due_date: order.due_date,
        tv_priority: order.tv_priority || 0,
        status: logs.length > 0 ? 'in_progress' : 'waiting',
        active_timers: logs.map((log: any) => ({
          ...log,
          item_description: descMap.get(log.production_item_number) || null,
        })),
        lines: [...lines]
          .sort((a: any, b: any) => {
            const pa = Number(a.tv_priority || 0)
            const pb = Number(b.tv_priority || 0)
            if (pa > 0 && pb > 0) return pa - pb
            if (pa > 0) return -1
            if (pb > 0) return 1
            return Number(a.line_no || 0) - Number(b.line_no || 0)
          })
          .map((l: any) => ({
          id: l.id,
          line_no: l.line_no,
          item_number: l.item_number,
          description: l.description,
          quantity: l.quantity,
          tv_priority: l.tv_priority || 0,
        })),
      }
    })

    // Sorteer: rang 1 eerst (laagste nummer = hoogste prio), 0 = geen prio onderaan
    result.sort((a: any, b: any) => {
      const pa = a.tv_priority || 0
      const pb = b.tv_priority || 0
      if (pa > 0 && pb > 0) return pa - pb
      if (pa > 0) return -1
      if (pb > 0) return 1
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1
      return 0
    })

    const response = NextResponse.json({ orders: result })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: any) {
    console.error('Error fetching production status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
