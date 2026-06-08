import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadLabelDetail = {
  label: string
  case_type: string | null
}

export function labelDetailsFromLabels(
  labels: string[],
  typeByLabel: Map<string, string | null>
): UploadLabelDetail[] {
  return labels.map((label) => ({
    label,
    case_type: typeByLabel.get(label) ?? null,
  }))
}

export function mergeLabelDetails(
  existing: UploadLabelDetail[] | null | undefined,
  incoming: UploadLabelDetail
): UploadLabelDetail[] {
  const map = new Map<string, UploadLabelDetail>()
  for (const entry of existing ?? []) {
    const label = String(entry.label || '').trim()
    if (!label) continue
    map.set(label, { label, case_type: entry.case_type ?? null })
  }
  const label = incoming.label.trim()
  if (label) {
    map.set(label, {
      label,
      case_type: incoming.case_type ?? map.get(label)?.case_type ?? null,
    })
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'nl-BE'))
}

export function resolveLabelDetails(
  stored: UploadLabelDetail[] | null | undefined,
  fallbackLabels: string[] | null | undefined,
  typeByLabel: Map<string, string | null>
): UploadLabelDetail[] {
  if (stored && stored.length > 0) {
    return stored.map((entry) => ({
      label: String(entry.label || '').trim(),
      case_type: entry.case_type ?? typeByLabel.get(String(entry.label || '').trim()) ?? null,
    })).filter((entry) => entry.label)
  }
  if (!fallbackLabels?.length) return []
  return labelDetailsFromLabels(fallbackLabels, typeByLabel)
}

const CHUNK = 200

async function fetchTypesFromTable(
  supabase: SupabaseClient,
  table: string,
  labels: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  for (let i = 0; i < labels.length; i += CHUNK) {
    const slice = labels.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from(table)
      .select('case_label, case_type')
      .in('case_label', slice)
    if (error) continue
    for (const row of data || []) {
      const label = String(row.case_label || '').trim()
      if (!label) continue
      map.set(label, row.case_type ? String(row.case_type).trim() : null)
    }
  }
  return map
}

/** Vult ontbrekende kisttypes aan via cases, packed_labels en forecast. */
export async function fetchCaseTypesForLabels(
  supabase: SupabaseClient,
  labels: string[]
): Promise<Map<string, string | null>> {
  const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))]
  const map = new Map<string, string | null>()
  if (unique.length === 0) return map

  const sources = [
    'grote_inpak_cases',
    'grote_inpak_packed_labels',
    'grote_inpak_forecast',
  ] as const

  for (const table of sources) {
    const partial = await fetchTypesFromTable(supabase, table, unique)
    partial.forEach((caseType, label) => {
      if (!map.has(label) || (caseType && !map.get(label))) {
        map.set(label, caseType)
      }
    })
  }

  return map
}
