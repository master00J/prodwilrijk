import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, end_time, production_order_number, production_item_number, production_step')
      .eq('type', 'production_order')

    if (dateFrom) {
      query = query.gte('start_time', dateFrom)
    }
    if (dateTo) {
      query = query.lte('start_time', dateTo)
    }

    const { data: logs, error } = await query
    if (error) {
      console.error('Error fetching KPI logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch KPI data' },
        { status: 500 }
      )
    }

    const employeeIds = [...new Set((logs || []).map((log: any) => log.employee_id))]
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .in('id', employeeIds)

    const employeeMap = new Map<number, string>()
    if (employees) {
      employees.forEach((emp: any) => employeeMap.set(emp.id, emp.name))
    }

    const orderTotals = new Map<string, number>()
    const stepTotals = new Map<string, number>()
    const employeeTotals = new Map<string, number>()
    const itemTotals = new Map<string, number>()

    ;(logs || []).forEach((log: any) => {
      if (!log.start_time) return
      const end = log.end_time ? new Date(log.end_time) : new Date()
      const seconds = calculateWorkedSeconds(new Date(log.start_time), end)
      const hours = seconds / 3600

      const orderKey = String(log.production_order_number || 'Onbekend').trim()
      const stepKey = String(log.production_step || 'Onbekend').trim()
      const itemKey = String(log.production_item_number || 'Onbekend').trim()
      const employeeName = employeeMap.get(log.employee_id) || `Employee ${log.employee_id}`

      orderTotals.set(orderKey, (orderTotals.get(orderKey) || 0) + hours)
      stepTotals.set(stepKey, (stepTotals.get(stepKey) || 0) + hours)
      itemTotals.set(itemKey, (itemTotals.get(itemKey) || 0) + hours)
      employeeTotals.set(employeeName, (employeeTotals.get(employeeName) || 0) + hours)
    })

    const toArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([key, value]) => ({ key, hours: Number(value.toFixed(2)) }))
        .sort((a, b) => b.hours - a.hours)

    return NextResponse.json({
      orders: toArray(orderTotals),
      steps: toArray(stepTotals),
      employees: toArray(employeeTotals),
      items: toArray(itemTotals),
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
