import { supabaseAdmin } from '@/lib/supabase/server'

/** Caselabels uit de laatste PILS-run (Willebroek / trailer). */
export async function loadPilsCaseLabels(): Promise<Set<string>> {
  const pageSize = 1000
  let from = 0
  const labels = new Set<string>()

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label')
      .range(from, from + pageSize - 1)

    if (error) throw error

    const rows = data || []
    for (const row of rows) {
      const label = String(row.case_label || '').trim()
      if (label) labels.add(label)
    }
    if (rows.length < pageSize) break
    from += rows.length
  }

  return labels
}

/** Zelfde filter als Forecast Excel: forecast-regels waarvan het label nog niet op PILS staat. */
export function excludeForecastRowsOnPils<T extends { case_label?: string | null }>(
  rows: T[],
  pilsLabels: Set<string>
): { active: T[]; excludedOnPils: number } {
  let excludedOnPils = 0
  const active = rows.filter(row => {
    const label = String(row.case_label || '').trim()
    if (!label) return true
    if (pilsLabels.has(label)) {
      excludedOnPils += 1
      return false
    }
    return true
  })
  return { active, excludedOnPils }
}

export type PilsCaseRow = {
  case_label: string
  case_type: string
  arrival_date: string | null
}

/** PILS-units zonder enige forecast-regel (wel in Willebroek/trailer, nooit in Atlas-forecast). */
export async function loadPilsOnlyCases(forecastLabels: Set<string>): Promise<PilsCaseRow[]> {
  const pageSize = 1000
  let from = 0
  const rows: PilsCaseRow[] = []

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date')
      .range(from, from + pageSize - 1)

    if (error) throw error

    const batch = data || []
    for (const row of batch) {
      const label = String(row.case_label || '').trim()
      if (!label || forecastLabels.has(label)) continue
      rows.push({
        case_label: label,
        case_type: String(row.case_type || '').trim(),
        arrival_date: row.arrival_date ? String(row.arrival_date) : null,
      })
    }
    if (batch.length < pageSize) break
    from += batch.length
  }

  return rows
}

export function filterRowsByArrivalDate<T extends { arrival_date?: string | null }>(
  rows: T[],
  dateFrom: string | null,
  dateTo: string | null
): T[] {
  if (!dateFrom && !dateTo) return rows
  const from = dateFrom ? new Date(dateFrom) : null
  const to = dateTo ? new Date(dateTo) : null
  return rows.filter(row => {
    if (!row.arrival_date) return !dateFrom && !dateTo
    const arrival = new Date(String(row.arrival_date))
    if (Number.isNaN(arrival.getTime())) return false
    if (from && arrival < from) return false
    if (to && arrival > to) return false
    return true
  })
}
