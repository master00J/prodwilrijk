import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'

/** Zelfde normalisatie als BC-FP / production item op de vloer. */
export function groteInpakFpMatchKey(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = normalizeErpCode(String(raw).trim())
  if (n) return n
  return String(raw).trim().toUpperCase().replace(/\s+/g, '') || null
}

export type ProductionTimeActiveSummary = {
  step: string
  production_order_number: string
  employees: string[]
  started_at: string
}

type LogRow = {
  employee_id: number
  production_item_number: string | null
  production_step: string | null
  production_order_number: string | null
  start_time: string
}

/** Actieve PO-tijdregistraties gegroepeerd per FP / item-sleutel. */
export function groupActiveProductionLogsByFp(
  logs: LogRow[],
  employeeNames: Map<number, string>,
): Map<string, ProductionTimeActiveSummary> {
  const groups = new Map<string, LogRow[]>()
  for (const log of logs) {
    const k = groteInpakFpMatchKey(log.production_item_number || undefined)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(log)
  }

  const out = new Map<string, ProductionTimeActiveSummary>()
  for (const [k, arr] of groups) {
    const steps = [
      ...new Set(arr.map((l) => String(l.production_step || '').trim()).filter(Boolean)),
    ]
    const orderNumbers = [
      ...new Set(arr.map((l) => String(l.production_order_number || '').trim()).filter(Boolean)),
    ]
    const employees = [
      ...new Set(arr.map((l) => employeeNames.get(l.employee_id) || `#${l.employee_id}`)),
    ]
    let started_at = arr[0]!.start_time
    for (const l of arr) {
      if (l.start_time < started_at) started_at = l.start_time
    }
    out.set(k, {
      step: steps.length === 1 ? steps[0]! : steps.join(' · '),
      production_order_number: orderNumbers[0] || '',
      employees,
      started_at,
    })
  }
  return out
}
