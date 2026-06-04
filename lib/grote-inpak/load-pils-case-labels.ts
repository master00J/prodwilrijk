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
