import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

export const dynamic = 'force-dynamic'

type ItemRun = {
  item_number: string
  order_number: string
  date: string
  totalHours: number
  quantity: number
  hoursPerPiece: number
  steps: { step: string; hours: number }[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, end_time, production_order_number, production_item_number, production_step, production_quantity')
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

    // Per (order_number, item_number) : { hours, quantity, steps, minDate }
    const runMap = new Map<string, { hours: number; quantity: number; steps: Map<string, number>; minDate: string }>()

    // Per (date, step) voor Zaag-dashboard en Analytics
    const dailyStepHours = new Map<string, number>()

    ;(logs || []).forEach((log: any) => {
      if (!log.start_time) return
      const end = log.end_time ? new Date(log.end_time) : new Date()
      const seconds = calculateWorkedSeconds(new Date(log.start_time), end)
      const hours = seconds / 3600
      const qty = log.production_quantity != null ? Math.max(0, Number(log.production_quantity)) : 1

      const orderKey = String(log.production_order_number || 'Onbekend').trim()
      const stepKey = String(log.production_step || 'Onbekend').trim()
      const itemKey = String(log.production_item_number || 'Onbekend').trim()
      const employeeName = employeeMap.get(log.employee_id) || `Employee ${log.employee_id}`
      const startDate = log.start_time.slice(0, 10)

      orderTotals.set(orderKey, (orderTotals.get(orderKey) || 0) + hours)
      stepTotals.set(stepKey, (stepTotals.get(stepKey) || 0) + hours)
      itemTotals.set(itemKey, (itemTotals.get(itemKey) || 0) + hours)
      employeeTotals.set(employeeName, (employeeTotals.get(employeeName) || 0) + hours)

      const dailyStepKey = `${startDate}::${stepKey}`
      dailyStepHours.set(dailyStepKey, (dailyStepHours.get(dailyStepKey) || 0) + hours)

      const runKey = `${orderKey}::${itemKey}`
      const existing = runMap.get(runKey)
      if (!existing) {
        const stepsMap = new Map<string, number>()
        stepsMap.set(stepKey, hours)
        runMap.set(runKey, { hours, quantity: qty, steps: stepsMap, minDate: startDate })
      } else {
        existing.hours += hours
        existing.quantity += qty
        existing.steps.set(stepKey, (existing.steps.get(stepKey) || 0) + hours)
        if (startDate < existing.minDate) existing.minDate = startDate
      }
    })

    const itemRuns: ItemRun[] = Array.from(runMap.entries()).map(([key, val]) => {
      const [order_number, item_number] = key.split('::')
      const hoursPerPiece = val.quantity > 0 ? val.hours / val.quantity : val.hours
      const steps = Array.from(val.steps.entries()).map(([step, hours]) => ({ step, hours })).sort((a, b) => b.hours - a.hours)
      return {
        item_number,
        order_number,
        date: val.minDate,
        totalHours: Number(val.hours.toFixed(4)),
        quantity: val.quantity,
        hoursPerPiece: Number(hoursPerPiece.toFixed(4)),
        steps,
      }
    })

    itemRuns.sort((a, b) => {
      const itemCmp = a.item_number.localeCompare(b.item_number)
      if (itemCmp !== 0) return itemCmp
      return a.date.localeCompare(b.date)
    })

    const toArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([key, value]) => ({ key, hours: Number(value.toFixed(2)) }))
        .sort((a, b) => b.hours - a.hours)

    // Zaag-uren per dag (stappen die "zaag" of "zagen" bevatten)
    const zaagByDate = new Map<string, number>()
    dailyStepHours.forEach((hours, key) => {
      const [, step] = key.split('::')
      const stepLower = (step || '').toLowerCase()
      if (stepLower.includes('zaag') || stepLower.includes('zagen')) {
        const date = key.split('::')[0]
        zaagByDate.set(date, (zaagByDate.get(date) || 0) + hours)
      }
    })
    const zaagByDateArray = Array.from(zaagByDate.entries())
      .map(([date, hours]) => ({ date, hours: Number(hours.toFixed(4)) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Daily step hours voor Analytics (alle stappen, per datum)
    const dailyStepHoursArray = Array.from(dailyStepHours.entries()).map(([key, hours]) => {
      const [date, step] = key.split('::')
      return { date, step, hours: Number(hours.toFixed(4)) }
    })

    return NextResponse.json({
      orders: toArray(orderTotals),
      steps: toArray(stepTotals),
      employees: toArray(employeeTotals),
      items: toArray(itemTotals),
      itemRuns,
      zaagByDate: zaagByDateArray,
      dailyStepHours: dailyStepHoursArray,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
