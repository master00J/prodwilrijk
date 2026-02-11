import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

export const dynamic = 'force-dynamic'

const getUnitCost = (component: any, price: number, unit: string) => {
  const unitValue = Number(component.component_unit) || 0
  if (unit === 'm3') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const thickness = Number(component.component_thickness) || 0
    const volume = (length * width * thickness) / 1_000_000_000
    return volume * unitValue * price
  }
  if (unit === 'm2') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const area = (length * width) / 1_000_000
    return area * unitValue * price
  }
  return unitValue * price
}

/** GET: Opbrengsten-overzicht voor een periode: uren, materiaalkost en verkoop per productie-run. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let logQuery = supabaseAdmin
      .from('time_logs')
      .select('id, start_time, end_time, production_order_number, production_item_number, production_step, production_quantity, employee_id')
      .eq('type', 'production_order')

    if (dateFrom) logQuery = logQuery.gte('start_time', dateFrom)
    if (dateTo) logQuery = logQuery.lte('start_time', dateTo)

    const { data: logs, error: logsError } = await logQuery
    if (logsError) {
      console.error('Error fetching time_logs:', logsError)
      return NextResponse.json({ error: 'Fout bij ophalen tijdregistraties' }, { status: 500 })
    }

    const employeeIds = [...new Set((logs || []).map((l: any) => l.employee_id).filter(Boolean))]
    let employeeMap = new Map<number, string>()
    if (employeeIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from('employees')
        .select('id, name')
        .in('id', employeeIds)
      if (employees) {
        employees.forEach((e: any) => employeeMap.set(e.id, e.name || `Medewerker ${e.id}`))
      }
    }

    const runMap = new Map<string, { hours: number; quantity: number; minDate: string; steps: Map<string, number>; employees: Map<number, number> }>()
    ;(logs || []).forEach((log: any) => {
      if (!log.start_time) return
      const end = log.end_time ? new Date(log.end_time) : new Date()
      const seconds = calculateWorkedSeconds(new Date(log.start_time), end)
      const hours = seconds / 3600
      const qty = log.production_quantity != null ? Math.max(0, Number(log.production_quantity)) : 1
      const orderKey = String(log.production_order_number || '').trim()
      const itemKey = String(log.production_item_number || '').trim()
      const stepKey = String(log.production_step || 'Onbekend').trim()
      const empId = log.employee_id != null ? Number(log.employee_id) : null
      const startDate = log.start_time.slice(0, 10)
      const key = `${orderKey}::${itemKey}`
      const existing = runMap.get(key)
      if (!existing) {
        const stepsMap = new Map<string, number>()
        stepsMap.set(stepKey, hours)
        const employeesMap = new Map<number, number>()
        if (empId != null) employeesMap.set(empId, hours)
        runMap.set(key, { hours, quantity: qty, minDate: startDate, steps: stepsMap, employees: employeesMap })
      } else {
        existing.hours += hours
        existing.quantity += qty
        existing.steps.set(stepKey, (existing.steps.get(stepKey) || 0) + hours)
        if (empId != null) existing.employees.set(empId, (existing.employees.get(empId) || 0) + hours)
        if (startDate < existing.minDate) existing.minDate = startDate
      }
    })

    const { data: orders, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id, order_number')
      .eq('for_time_registration', true)

    if (orderError || !orders?.length) {
      const runs = Array.from(runMap.entries()).map(([key, val]) => {
        const [order_number, item_number] = key.split('::')
        const hoursPerPiece = val.quantity > 0 ? val.hours / val.quantity : 0
        const steps = Array.from(val.steps.entries())
          .map(([step, hours]) => ({ step, hours: Number(hours.toFixed(4)) }))
          .sort((a, b) => b.hours - a.hours)
        const employees = Array.from(val.employees.entries())
          .map(([id, hours]) => ({ employee_name: employeeMap.get(id) || `Medewerker ${id}`, hours: Number(hours.toFixed(4)) }))
          .sort((a, b) => b.hours - a.hours)
        return {
          item_number,
          order_number,
          date: val.minDate,
          quantity: val.quantity,
          hours: Number(val.hours.toFixed(4)),
          hours_per_piece: Number(hoursPerPiece.toFixed(4)),
          steps,
          employees,
          sales_price: null as number | null,
          revenue: null as number | null,
          material_cost_per_item: null as number | null,
          material_cost_total: null as number | null,
          margin: null as number | null,
          description: null as string | null,
        }
      })
      const totalRevenue = 0
      const totalMaterial = 0
      const totalHours = runs.reduce((s, r) => s + r.hours, 0)
      return NextResponse.json({
        runs: runs.sort((a, b) => a.date.localeCompare(b.date) || a.item_number.localeCompare(b.item_number)),
        totals: { total_revenue: totalRevenue, total_material_cost: totalMaterial, total_hours: totalHours, total_margin: totalRevenue - totalMaterial },
      })
    }

    const orderIds = orders.map((o: any) => o.id)
    const orderByNumber = new Map<string, string>()
    orders.forEach((o: any) => orderByNumber.set(o.order_number, o.id))

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select(
        `
        id, production_order_id, item_number, description, quantity, sales_price,
        production_order_components (
          component_item_no, component_description, component_description_2,
          component_unit, component_length, component_width, component_thickness
        )
      `
      )
      .in('production_order_id', orderIds)

    if (linesError) {
      console.error('Error fetching lines:', linesError)
      return NextResponse.json({ error: 'Fout bij ophalen orderlijnen' }, { status: 500 })
    }

    const componentItemNumbers = new Set<string>()
    ;(lines || []).forEach((line: any) => {
      ;(line.production_order_components || []).forEach((c: any) => {
        if (c.component_item_no) componentItemNumbers.add(c.component_item_no)
      })
    })

    let priceMap: Record<string, number> = {}
    let unitMap: Record<string, string> = {}
    if (componentItemNumbers.size > 0) {
      const { data: prices } = await supabaseAdmin
        .from('material_prices')
        .select('item_number, price, unit_of_measure')
        .in('item_number', Array.from(componentItemNumbers))
      priceMap = (prices || []).reduce((acc: Record<string, number>, p: any) => {
        acc[p.item_number] = Number(p.price) || 0
        return acc
      }, {})
      unitMap = (prices || []).reduce((acc: Record<string, string>, p: any) => {
        if (p.unit_of_measure) acc[p.item_number] = String(p.unit_of_measure).trim()
        return acc
      }, {})
    }

    const lineCostMap = new Map<string, { cost_per_item: number; sales_price: number | null; description: string | null }>()
    const orderIdToNumber = new Map<string, string>()
    orders.forEach((o: any) => orderIdToNumber.set(o.id, o.order_number))

    ;(lines || []).forEach((line: any) => {
      const orderNum = orderIdToNumber.get(line.production_order_id)
      if (!orderNum) return
      const itemNum = (line.item_number || '').trim()
      const key = `${orderNum}::${itemNum}`
      let costPerItem = 0
      ;(line.production_order_components || []).forEach((comp: any) => {
        const itemNo = comp.component_item_no
        const price = itemNo && priceMap[itemNo] !== undefined ? priceMap[itemNo] : null
        if (price == null) return
        const unit = (itemNo && unitMap[itemNo]) || 'stuks'
        costPerItem += getUnitCost(comp, price, unit)
      })
      lineCostMap.set(key, {
        cost_per_item: costPerItem,
        sales_price: line.sales_price != null ? Number(line.sales_price) : null,
        description: line.description || null,
      })
    })

    let totalRevenue = 0
    let totalMaterial = 0

    const runs = Array.from(runMap.entries()).map(([key, val]) => {
      const [order_number, item_number] = key.split('::')
      const meta = lineCostMap.get(key)
      const salesPrice = meta?.sales_price ?? null
      const costPerItem = meta?.cost_per_item ?? 0
      const revenue = salesPrice != null && val.quantity > 0 ? salesPrice * val.quantity : null
      const materialTotal = costPerItem * val.quantity
      const margin = revenue != null ? revenue - materialTotal : null
      if (revenue != null) totalRevenue += revenue
      totalMaterial += materialTotal
      const hoursPerPiece = val.quantity > 0 ? val.hours / val.quantity : 0
      const steps = Array.from(val.steps.entries())
        .map(([step, hours]) => ({ step, hours: Number(hours.toFixed(4)) }))
        .sort((a, b) => b.hours - a.hours)
      const employees = Array.from(val.employees.entries())
        .map(([id, hours]) => ({ employee_name: employeeMap.get(id) || `Medewerker ${id}`, hours: Number(hours.toFixed(4)) }))
        .sort((a, b) => b.hours - a.hours)
      return {
        item_number,
        order_number,
        date: val.minDate,
        quantity: val.quantity,
        hours: Number(val.hours.toFixed(4)),
        hours_per_piece: Number(hoursPerPiece.toFixed(4)),
        steps,
        employees,
        sales_price: salesPrice,
        revenue,
        material_cost_per_item: Number(costPerItem.toFixed(2)),
        material_cost_total: Number(materialTotal.toFixed(2)),
        margin: margin != null ? Number(margin.toFixed(2)) : null,
        description: meta?.description ?? null,
      }
    })

    const totalHours = runs.reduce((s, r) => s + r.hours, 0)
    const totalMargin = totalRevenue - totalMaterial

    return NextResponse.json({
      runs: runs.sort((a, b) => a.date.localeCompare(b.date) || a.item_number.localeCompare(b.item_number)),
      totals: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_material_cost: Number(totalMaterial.toFixed(2)),
        total_hours: Number(totalHours.toFixed(2)),
        total_margin: Number(totalMargin.toFixed(2)),
      },
    })
  } catch (error) {
    console.error('Unexpected error revenue API:', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
