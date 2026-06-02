import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'
import { resolveAssistantDateRange } from '@/lib/personal-assistant/date-range'

const SITES = ['wilrijk', 'genk'] as const

type ActiveSession = {
  id: number
  employee_id: number
  employee_name: string
  start_time: string
  elapsed_seconds: number
  order_number: string
  item_number: string
  step: string
  quantity: number | null
  site: string
}

function groupActiveByOrder(sessions: ActiveSession[]) {
  const map = new Map<
    string,
    {
      order_number: string
      site: string
      workers: string[]
      items: string[]
      steps: string[]
      maxElapsed: number
    }
  >()

  for (const session of sessions) {
    const key = `${session.site}::${session.order_number || 'Onbekend'}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        order_number: session.order_number || 'Onbekend',
        site: session.site,
        workers: session.employee_name ? [session.employee_name] : [],
        items: session.item_number ? [session.item_number] : [],
        steps: session.step ? [session.step] : [],
        maxElapsed: session.elapsed_seconds || 0,
      })
      continue
    }
    if (session.employee_name && !existing.workers.includes(session.employee_name)) {
      existing.workers.push(session.employee_name)
    }
    if (session.item_number && !existing.items.includes(session.item_number)) {
      existing.items.push(session.item_number)
    }
    if (session.step && !existing.steps.includes(session.step)) {
      existing.steps.push(session.step)
    }
    existing.maxElapsed = Math.max(existing.maxElapsed, session.elapsed_seconds || 0)
  }

  return Array.from(map.values()).sort(
    (a, b) => b.maxElapsed - a.maxElapsed || a.order_number.localeCompare(b.order_number)
  )
}

export async function getActiveProductionSummary(sites?: string[]) {
  const siteList = (sites?.length ? sites : [...SITES]).map(s => s.toLowerCase())
  const allSessions: Array<{
    site: string
    employee_name: string
    order_number: string
    item_number: string
    step: string
    elapsed_seconds: number
    start_time: string
  }> = []

  for (const site of siteList) {
    const { data: timeLogs, error } = await supabaseAdmin
      .from('time_logs')
      .select(
        'id, employee_id, start_time, production_order_number, production_item_number, production_step, site'
      )
      .is('end_time', null)
      .eq('type', 'production_order')
      .eq('site', site)
      .order('start_time', { ascending: false })
      .limit(80)

    if (error) throw error
    if (!timeLogs?.length) continue

    const empIds = [...new Set(timeLogs.map(log => log.employee_id))]
    const { data: employees } = await supabaseAdmin.from('employees').select('id, name').in('id', empIds)
    const empMap = new Map<number, string>()
    for (const emp of employees || []) {
      empMap.set(Number(emp.id), String(emp.name || ''))
    }

    const now = new Date()
    for (const log of timeLogs) {
      const start = new Date(log.start_time)
      allSessions.push({
        site,
        employee_name: empMap.get(Number(log.employee_id)) || `Werknemer ${log.employee_id}`,
        order_number: log.production_order_number || '',
        item_number: log.production_item_number || '',
        step: log.production_step || '',
        elapsed_seconds: calculateWorkedSeconds(start, now),
        start_time: log.start_time,
      })
    }
  }

  const grouped = groupActiveByOrder(
    allSessions.map(s => ({
      id: 0,
      employee_id: 0,
      employee_name: s.employee_name,
      start_time: s.start_time,
      elapsed_seconds: s.elapsed_seconds,
      order_number: s.order_number,
      item_number: s.item_number,
      step: s.step,
      quantity: null,
      site: s.site,
    }))
  )

  return {
    source: 'admin/production-order-kpi live',
    active_sessions: allSessions.length,
    active_orders: grouped.length,
    orders: grouped.slice(0, 10).map(g => ({
      order_number: g.order_number,
      site: g.site,
      workers: g.workers,
      items: g.items.slice(0, 3),
      steps: g.steps.slice(0, 3),
      max_elapsed_minutes: Math.round(g.maxElapsed / 60),
    })),
  }
}

export async function getProductionKpiSummary(input?: {
  site?: string
  date_from?: string
  date_to?: string
  period?: string
}) {
  const site = (input?.site || 'wilrijk').toLowerCase()
  const range = resolveAssistantDateRange({
    date_from: input?.date_from,
    date_to: input?.date_to,
    period: input?.period,
    defaultDays: 7,
  })

  let query = supabaseAdmin
    .from('time_logs')
    .select(
      'employee_id, start_time, end_time, production_order_number, production_item_number, production_step, production_quantity'
    )
    .eq('type', 'production_order')
    .eq('site', site)
    .gte('start_time', `${range.date_from}T00:00:00`)
    .lte('start_time', `${range.date_to}T23:59:59`)

  const { data: logs, error } = await query
  if (error) throw error

  const rows = logs || []
  let totalSeconds = 0
  let totalQty = 0
  const orders = new Set<string>()
  const employees = new Set<number>()

  for (const log of rows) {
    const start = new Date(log.start_time)
    const end = log.end_time ? new Date(log.end_time) : new Date()
    totalSeconds += calculateWorkedSeconds(start, end)
    totalQty += Number(log.production_quantity) || 0
    if (log.production_order_number) orders.add(String(log.production_order_number))
    employees.add(Number(log.employee_id))
  }

  const hours = totalSeconds / 3600
  const hoursPerPiece = totalQty > 0 ? totalSeconds / 3600 / totalQty : null

  return {
    source: 'admin/production-order-kpi',
    site,
    period: range,
    total_logs: rows.length,
    unique_orders: orders.size,
    unique_employees: employees.size,
    total_hours: Math.round(hours * 10) / 10,
    total_quantity: totalQty,
    hours_per_piece: hoursPerPiece != null ? Math.round(hoursPerPiece * 1000) / 1000 : null,
  }
}
