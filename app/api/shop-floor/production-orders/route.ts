import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'
import { normalizeSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OrderStatus = 'not_started' | 'in_progress' | 'partial' | 'completed'

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getOrderStatus(requiredQty: number, completedQty: number, activeCount: number): OrderStatus {
  if (completedQty >= requiredQty && requiredQty > 0) return 'completed'
  if (activeCount > 0) return 'in_progress'
  if (completedQty > 0) return 'partial'
  return 'not_started'
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    const site = normalizeSite(request.nextUrl.searchParams.get('site'))

    let orderQuery = supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, uploaded_at, finished_at, site')
      .eq('for_time_registration', true)
      .eq('site', site)
      .is('finished_at', null)
      .order('uploaded_at', { ascending: false })

    const { data: rawOrders, error: ordersError } = await orderQuery
    if (ordersError) throw ordersError

    let orders = rawOrders || []
    if (q) {
      orders = orders.filter(
        (order: any) =>
          String(order.order_number || '').toLowerCase().includes(q) ||
          String(order.sales_order_number || '').toLowerCase().includes(q)
      )
    }

    const orderIds = orders.map((order: any) => order.id)
    const orderNumbers = orders.map((order: any) => String(order.order_number || '').trim()).filter(Boolean)

    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [], summary: { total: 0, inProgress: 0, partial: 0, notStarted: 0, completed: 0 } })
    }

    const [{ data: lines, error: linesError }, { data: logs, error: logsError }] = await Promise.all([
      supabaseAdmin
        .from('production_order_lines')
        .select('id, production_order_id, line_no, item_number, item_no, description, description_2, quantity')
        .in('production_order_id', orderIds)
        .order('line_no', { ascending: true }),
      supabaseAdmin
        .from('time_logs')
        .select('id, employee_id, start_time, end_time, production_order_number, production_item_number, production_step, production_quantity')
        .eq('type', 'production_order')
        .eq('site', site)
        .in('production_order_number', orderNumbers),
    ])

    if (linesError) throw linesError
    if (logsError) throw logsError

    const employeeIds = [...new Set((logs || []).map((log: any) => log.employee_id).filter(Boolean))]
    const { data: employees } = employeeIds.length > 0
      ? await supabaseAdmin.from('employees').select('id, name').in('id', employeeIds)
      : { data: [] as any[] }

    const employeeMap = new Map<number, string>()
    ;(employees || []).forEach((employee: any) => employeeMap.set(employee.id, employee.name))

    const linesByOrderId = new Map<number, any[]>()
    ;(lines || []).forEach((line: any) => {
      const list = linesByOrderId.get(line.production_order_id) || []
      list.push(line)
      linesByOrderId.set(line.production_order_id, list)
    })

    const now = new Date()
    const logsByOrderAndItem = new Map<string, any[]>()
    ;(logs || []).forEach((log: any) => {
      const orderNumber = String(log.production_order_number || '').trim()
      const itemNumber = String(log.production_item_number || '').trim()
      const key = `${orderNumber}::${itemNumber}`
      const list = logsByOrderAndItem.get(key) || []
      list.push(log)
      logsByOrderAndItem.set(key, list)
    })

    const summary = { total: orders.length, inProgress: 0, partial: 0, notStarted: 0, completed: 0 }

    const mappedOrders = orders.map((order: any) => {
      const orderLines = linesByOrderId.get(order.id) || []
      let requiredQty = 0
      let completedQty = 0
      let activeCount = 0
      let activeEmployees = new Set<string>()

      const mappedLines = orderLines.map((line: any) => {
        const itemNumber = String(line.item_number || line.item_no || '').trim()
        const required = Math.max(1, Number(line.quantity) || 1)
        const lineLogs = logsByOrderAndItem.get(`${order.order_number}::${itemNumber}`) || []
        const completed = lineLogs
          .filter((log: any) => log.end_time)
          .reduce((sum: number, log: any) => sum + (log.production_quantity == null ? 1 : Math.max(0, Number(log.production_quantity))), 0)
        const active = lineLogs.filter((log: any) => !log.end_time)

        requiredQty += required
        completedQty += completed
        activeCount += active.length
        active.forEach((log: any) => {
          activeEmployees.add(employeeMap.get(log.employee_id) || `Medewerker ${log.employee_id}`)
        })

        const activeLogs = active.map((log: any) => ({
          id: log.id,
          employeeName: employeeMap.get(log.employee_id) || `Medewerker ${log.employee_id}`,
          step: log.production_step || 'Onbekend',
          startTime: log.start_time,
          elapsedSeconds: calculateWorkedSeconds(new Date(log.start_time), now),
        }))

        return {
          id: line.id,
          lineNo: line.line_no,
          itemNumber,
          description: line.description || line.description_2 || '',
          requiredQty: required,
          completedQty: completed,
          remainingQty: Math.max(0, required - completed),
          progress: clampProgress((completed / required) * 100),
          status: getOrderStatus(required, completed, active.length),
          activeLogs,
        }
      })

      const status = getOrderStatus(requiredQty, completedQty, activeCount)
      if (status === 'in_progress') summary.inProgress += 1
      if (status === 'partial') summary.partial += 1
      if (status === 'not_started') summary.notStarted += 1
      if (status === 'completed') summary.completed += 1

      return {
        orderNumber: order.order_number,
        salesOrderNumber: order.sales_order_number,
        uploadedAt: order.uploaded_at,
        site: order.site || site,
        status,
        requiredQty,
        completedQty,
        remainingQty: Math.max(0, requiredQty - completedQty),
        progress: requiredQty > 0 ? clampProgress((completedQty / requiredQty) * 100) : 0,
        activeEmployees: Array.from(activeEmployees),
        lines: mappedLines,
      }
    })

    return NextResponse.json({ orders: mappedOrders, summary })
  } catch (error: any) {
    console.error('Error loading shop floor production orders:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen shop-floor data' },
      { status: 500 }
    )
  }
}
