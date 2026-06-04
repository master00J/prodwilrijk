import type { ItemAnalysis, ItemOrderComparison, ItemRunComparison, RevenueRun } from './types'

function normalizeItemKey(item: string) {
  return (item || '').trim().toUpperCase()
}

export function getUniqueItems(runs: RevenueRun[]): string[] {
  const items = new Set<string>()
  runs.forEach((r) => {
    const key = (r.item_number || '').trim()
    if (key) items.add(key)
  })
  return Array.from(items).sort((a, b) => a.localeCompare(b))
}

/** Items that appear in more than one production run (different order and/or date). */
export function getItemsWithVariation(runs: RevenueRun[]): { item_number: string; runCount: number; spread: number }[] {
  const byItem = new Map<string, RevenueRun[]>()
  runs.forEach((r) => {
    const key = (r.item_number || '').trim()
    if (!key) return
    const list = byItem.get(key) ?? []
    list.push(r)
    byItem.set(key, list)
  })

  return Array.from(byItem.entries())
    .filter(([, list]) => list.length > 1)
    .map(([item_number, list]) => {
      const values = list.map((r) => r.hours_per_piece).filter((v) => Number.isFinite(v))
      const min = values.length ? Math.min(...values) : 0
      const max = values.length ? Math.max(...values) : 0
      return { item_number, runCount: list.length, spread: max - min }
    })
    .sort((a, b) => b.spread - a.spread)
}

export function itemMatchesQuery(
  itemNumber: string,
  query: string,
  toNew: (c: string) => string,
  toOld: (c: string) => string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const raw = (itemNumber || '').toLowerCase()
  const newer = toNew(itemNumber).toLowerCase()
  const older = toOld(itemNumber).toLowerCase()
  return raw.includes(q) || newer.includes(q) || older.includes(q)
}

export function filterRunsByItem(
  runs: RevenueRun[],
  itemNumber: string,
  toNew: (c: string) => string,
  toOld: (c: string) => string
): RevenueRun[] {
  const target = normalizeItemKey(itemNumber)
  return runs.filter((r) => {
    const raw = normalizeItemKey(r.item_number)
    if (raw === target) return true
    if (normalizeItemKey(toNew(r.item_number)) === target) return true
    if (normalizeItemKey(toOld(r.item_number)) === target) return true
    return normalizeItemKey(toNew(itemNumber)) === raw || normalizeItemKey(toOld(itemNumber)) === raw
  })
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function buildRunComparisons(itemRuns: RevenueRun[]): ItemRunComparison[] {
  const hppValues = itemRuns.map((r) => r.hours_per_piece).filter((v) => Number.isFinite(v))
  const avgHpp = avg(hppValues)

  const marginValues = itemRuns.map((r) => r.margin).filter((m): m is number => m != null && Number.isFinite(m))
  const avgMargin = marginValues.length ? avg(marginValues) : null

  return itemRuns
    .map((run) => {
      const hoursPerPieceDelta = run.hours_per_piece - avgHpp
      const hoursPerPieceDeltaPct = avgHpp > 0 ? (hoursPerPieceDelta / avgHpp) * 100 : 0
      const marginDelta = run.margin != null && avgMargin != null ? run.margin - avgMargin : null
      const marginDeltaPct =
        run.margin != null && avgMargin != null && avgMargin !== 0
          ? ((run.margin - avgMargin) / Math.abs(avgMargin)) * 100
          : null
      const employeesLabel = (run.employees ?? [])
        .map((e) => e.employee_name)
        .filter(Boolean)
        .join(', ')

      return {
        run,
        hoursPerPieceDelta,
        hoursPerPieceDeltaPct,
        marginDelta,
        marginDeltaPct,
        employeesLabel: employeesLabel || '–',
        isFastest: hppValues.length > 1 && run.hours_per_piece === Math.min(...hppValues),
        isSlowest: hppValues.length > 1 && run.hours_per_piece === Math.max(...hppValues),
      }
    })
    .sort((a, b) => a.run.date.localeCompare(b.run.date) || a.run.order_number.localeCompare(b.run.order_number))
}

function buildOrderComparisons(
  itemRuns: RevenueRun[],
  orderSummaries: ItemAnalysis['orders']
): ItemOrderComparison[] {
  const avgTotalHours = avg(orderSummaries.map((o) => o.hours))
  const hppValues = orderSummaries.map((o) => o.hoursPerPiece).filter((v) => Number.isFinite(v))
  const avgHpp = avg(hppValues)
  const totalHoursValues = orderSummaries.map((o) => o.hours)

  return orderSummaries
    .map((order) => {
      const totalHoursDelta = order.hours - avgTotalHours
      const totalHoursDeltaPct = avgTotalHours > 0 ? (totalHoursDelta / avgTotalHours) * 100 : 0
      const hoursPerPieceDelta = order.hoursPerPiece - avgHpp
      const hoursPerPieceDeltaPct = avgHpp > 0 ? (hoursPerPieceDelta / avgHpp) * 100 : 0

      const employees = new Set<string>()
      itemRuns
        .filter((r) => r.order_number === order.order_number)
        .forEach((run) => {
          ;(run.employees ?? []).forEach((e) => {
            if (e.employee_name) employees.add(e.employee_name)
          })
        })

      return {
        ...order,
        employeesLabel: employees.size > 0 ? Array.from(employees).join(', ') : '–',
        totalHoursDelta,
        totalHoursDeltaPct,
        hoursPerPieceDelta,
        hoursPerPieceDeltaPct,
        isFastestTotal:
          totalHoursValues.length > 1 && order.hours === Math.min(...totalHoursValues),
        isSlowestTotal:
          totalHoursValues.length > 1 && order.hours === Math.max(...totalHoursValues),
        isFastestPerPiece:
          hppValues.length > 1 && order.hoursPerPiece === Math.min(...hppValues),
        isSlowestPerPiece:
          hppValues.length > 1 && order.hoursPerPiece === Math.max(...hppValues),
      }
    })
    .sort((a, b) => b.hours - a.hours)
}

export function analyzeItemRuns(itemNumber: string, itemRuns: RevenueRun[]): ItemAnalysis | null {
  if (itemRuns.length === 0) return null

  const displayItem = itemNumber.trim() || itemRuns[0].item_number

  const hppValues = itemRuns.map((r) => r.hours_per_piece).filter((v) => Number.isFinite(v))
  const minHpp = hppValues.length ? Math.min(...hppValues) : 0
  const maxHpp = hppValues.length ? Math.max(...hppValues) : 0
  const avgHpp = avg(hppValues)

  const marginValues = itemRuns.map((r) => r.margin).filter((m): m is number => m != null && Number.isFinite(m))
  const minMargin = marginValues.length ? Math.min(...marginValues) : null
  const maxMargin = marginValues.length ? Math.max(...marginValues) : null
  const avgMarginVal = marginValues.length ? avg(marginValues) : null

  const employeeMap = new Map<string, { hours: number; runCount: number }>()
  itemRuns.forEach((run) => {
    ;(run.employees ?? []).forEach((e) => {
      const existing = employeeMap.get(e.employee_name) ?? { hours: 0, runCount: 0 }
      existing.hours += e.hours
      existing.runCount += 1
      employeeMap.set(e.employee_name, existing)
    })
  })

  const orderMap = new Map<
    string,
    { runs: number; hours: number; quantity: number; dates: string[] }
  >()
  itemRuns.forEach((run) => {
    const existing = orderMap.get(run.order_number) ?? {
      runs: 0,
      hours: 0,
      quantity: 0,
      dates: [],
    }
    existing.runs += 1
    existing.hours += run.hours
    existing.quantity += run.quantity || 0
    if (run.date) existing.dates.push(run.date)
    orderMap.set(run.order_number, existing)
  })

  const orders = Array.from(orderMap.entries())
    .map(([order_number, data]) => {
      const dates = [...data.dates].sort()
      const hoursPerPiece = data.quantity > 0 ? data.hours / data.quantity : 0
      return {
        order_number,
        runs: data.runs,
        quantity: data.quantity,
        hours: data.hours,
        hoursPerPiece,
        dateFrom: dates[0] ?? '',
        dateTo: dates[dates.length - 1] ?? '',
        employeesLabel: '',
      }
    })
    .sort((a, b) => b.hours - a.hours)

  const orderHoursValues = orders.map((o) => o.hours)
  const minOrderHours = orderHoursValues.length ? Math.min(...orderHoursValues) : 0
  const maxOrderHours = orderHoursValues.length ? Math.max(...orderHoursValues) : 0
  const avgOrderHours = avg(orderHoursValues)

  const stepMap = new Map<string, number>()
  itemRuns.forEach((run) => {
    ;(run.steps ?? []).forEach((s) => {
      stepMap.set(s.step, (stepMap.get(s.step) || 0) + s.hours)
    })
  })

  return {
    item_number: displayItem,
    description: itemRuns.find((r) => r.description)?.description ?? null,
    runs: itemRuns,
    runCount: itemRuns.length,
    orderCount: new Set(itemRuns.map((r) => r.order_number)).size,
    employeeCount: employeeMap.size,
    totalQuantity: itemRuns.reduce((s, r) => s + (r.quantity || 0), 0),
    totalHours: itemRuns.reduce((s, r) => s + (r.hours || 0), 0),
    hoursPerPiece: {
      min: minHpp,
      max: maxHpp,
      avg: avgHpp,
      spread: maxHpp - minHpp,
      spreadPct: avgHpp > 0 ? ((maxHpp - minHpp) / avgHpp) * 100 : 0,
    },
    totalHoursPerOrder: {
      min: minOrderHours,
      max: maxOrderHours,
      avg: avgOrderHours,
      spread: maxOrderHours - minOrderHours,
      spreadPct: avgOrderHours > 0 ? ((maxOrderHours - minOrderHours) / avgOrderHours) * 100 : 0,
    },
    margin:
      marginValues.length > 0
        ? {
            min: minMargin,
            max: maxMargin,
            avg: avgMarginVal,
            spread: minMargin != null && maxMargin != null ? maxMargin - minMargin : null,
          }
        : null,
    employees: Array.from(employeeMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.hours - a.hours),
    orders,
    orderComparisons: buildOrderComparisons(itemRuns, orders),
    steps: Array.from(stepMap.entries())
      .map(([step, hours]) => ({ step, hours }))
      .sort((a, b) => b.hours - a.hours),
    runComparisons: buildRunComparisons(itemRuns),
  }
}
