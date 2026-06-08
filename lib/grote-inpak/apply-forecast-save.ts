import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'

export type ApplyForecastSaveResult =
  | {
      ok: true
      replace: false
      data: any[]
      count: number
    }
  | {
      ok: true
      replace: true
      data: any[]
      count: number
      snapshot_id: string
      changes: { added: number; removed: number; date_change: number }
    }

/**
 * Zelfde gedrag als POST /api/grote-inpak/forecast: dedupe op case_label, optioneel volledige replace + snapshot.
 * `uploadedFileNames`: bestandsnamen uit de upload-sessie (UI); snapshot `source_files` toont dan altijd alle gekozen files, ook als dedupe geen winnende rij meer voor een file heeft.
 */
export async function applyForecastSave(
  forecastData: any[],
  replace: boolean,
  options?: { uploadedFileNames?: string[] }
): Promise<ApplyForecastSaveResult | { ok: false; error: string }> {
  if (!Array.isArray(forecastData)) {
    return { ok: false, error: 'forecastData must be an array' }
  }

  const dedupedMap = new Map<string, any>()
  forecastData.forEach((row: any) => {
    const label = String(row.case_label || '').trim()
    if (!label) return
    const arrivalDate = String(row.arrival_date || '').trim()
    const existing = dedupedMap.get(label)
    if (!existing) {
      dedupedMap.set(label, { ...row, case_label: label })
      return
    }
    if (arrivalDate) {
      const currentDate = new Date(existing.arrival_date)
      const newDate = new Date(arrivalDate)
      const curMs = currentDate.getTime()
      const newMs = newDate.getTime()
      // Bij gelijke datum wint de **laatste** rij in de upload-array (zodat o.a. FORESCO specials na standaard nog zichtbaar is in source_file).
      if (!Number.isNaN(newMs) && (Number.isNaN(curMs) || newMs >= curMs)) {
        dedupedMap.set(label, { ...row, case_label: label })
      }
    }
  })

  const deduped = Array.from(dedupedMap.values())

  let currentForecast: any[] = []
  if (replace) {
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data: currentData, error: currentError } = await supabaseAdmin
        .from('grote_inpak_forecast')
        .select('case_label, case_type, arrival_date, source_file')
        .order('arrival_date', { ascending: true })
        .order('case_label', { ascending: true })
        .range(from, from + pageSize - 1)

      if (currentError) throw currentError
      const chunk = currentData || []
      if (chunk.length === 0) break
      currentForecast.push(...chunk)
      from += chunk.length
    }

    const { error: deleteError } = await supabaseAdmin.from('grote_inpak_forecast').delete().not('id', 'is', null)

    if (deleteError) throw deleteError
  }

  const UPSERT_BATCH = 500
  for (let i = 0; i < deduped.length; i += UPSERT_BATCH) {
    const slice = deduped.slice(i, i + UPSERT_BATCH)
    const { error } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .upsert(slice, { onConflict: 'case_label', ignoreDuplicates: false })
    if (error) throw error
  }

  if (replace) {
    const snapshotId = randomUUID()
    const changes: any[] = []

    const currentMap = new Map<string, any>()
    currentForecast.forEach((row) => {
      const label = String(row.case_label || '').trim()
      if (!label) return
      currentMap.set(label, row)
    })

    const newLabels = new Set<string>()
    deduped.forEach((row: any) => {
      const label = String(row.case_label || '').trim()
      if (!label) return
      newLabels.add(label)

      const prev = currentMap.get(label)
      if (!prev) {
        changes.push({
          case_label: label,
          case_type: row.case_type || null,
          old_arrival_date: null,
          new_arrival_date: String(row.arrival_date || '').trim() || null,
          source_file: row.source_file || null,
          change_type: 'added',
          snapshot_id: snapshotId,
        })
      } else {
        const oldDate = String(prev.arrival_date || '').trim()
        const newDate = String(row.arrival_date || '').trim()
        if (oldDate && newDate && oldDate !== newDate) {
          changes.push({
            case_label: label,
            case_type: row.case_type || prev.case_type || null,
            old_arrival_date: oldDate,
            new_arrival_date: newDate,
            source_file: row.source_file || prev.source_file || null,
            change_type: 'date_change',
            snapshot_id: snapshotId,
          })
        }
      }
    })

    currentMap.forEach((row, label) => {
      if (!newLabels.has(label)) {
        changes.push({
          case_label: label,
          case_type: row.case_type || null,
          old_arrival_date: String(row.arrival_date || '').trim() || null,
          new_arrival_date: null,
          source_file: row.source_file || null,
          change_type: 'removed',
          snapshot_id: snapshotId,
        })
      }
    })

    const addedChanges = changes.filter((c) => c.change_type === 'added')
    const removedChanges = changes.filter((c) => c.change_type === 'removed')
    const cntAdded = addedChanges.length
    const cntRemoved = removedChanges.length
    const cntDateChange = changes.filter((c) => c.change_type === 'date_change').length

    const labelsAdded = addedChanges.map((c) => c.case_label).sort().slice(0, 500)
    const labelsRemoved = removedChanges.map((c) => c.case_label).sort().slice(0, 500)
    const labelsAddedDetail = addedChanges
      .map((c) => ({ label: c.case_label, case_type: c.case_type ?? null }))
      .sort((a, b) => a.label.localeCompare(b.label, 'nl-BE'))
      .slice(0, 500)
    const labelsRemovedDetail = removedChanges
      .map((c) => ({ label: c.case_label, case_type: c.case_type ?? null }))
      .sort((a, b) => a.label.localeCompare(b.label, 'nl-BE'))
      .slice(0, 500)

    const fromRows = deduped.map((r: any) => String(r.source_file || '').trim()).filter(Boolean)
    const fromUpload = (options?.uploadedFileNames || []).map((n) => String(n || '').trim()).filter(Boolean)
    const sourceFilesUnion = [...new Set([...fromUpload, ...fromRows])].sort((a, b) => a.localeCompare(b))

    await supabaseAdmin.from('grote_inpak_forecast_snapshots').insert({
      id: snapshotId,
      source_files: sourceFilesUnion.length > 0 ? sourceFilesUnion : null,
      total_records: deduped.length,
      cnt_added: cntAdded,
      cnt_removed: cntRemoved,
      cnt_date_change: cntDateChange,
      labels_added: labelsAdded.length > 0 ? labelsAdded : null,
      labels_removed: labelsRemoved.length > 0 ? labelsRemoved : null,
      labels_added_detail: labelsAddedDetail.length > 0 ? labelsAddedDetail : null,
      labels_removed_detail: labelsRemovedDetail.length > 0 ? labelsRemovedDetail : null,
    })

    if (changes.length > 0) {
      const CHG_BATCH = 500
      for (let i = 0; i < changes.length; i += CHG_BATCH) {
        const slice = changes.slice(i, i + CHG_BATCH)
        const { error: changeError } = await supabaseAdmin.from('grote_inpak_forecast_changes').insert(slice)
        if (changeError) throw changeError
      }
    }

    return {
      ok: true,
      replace: true,
      data: deduped,
      count: deduped.length,
      snapshot_id: snapshotId,
      changes: { added: cntAdded, removed: cntRemoved, date_change: cntDateChange },
    }
  }

  return { ok: true, replace: false, data: deduped, count: deduped.length }
}
