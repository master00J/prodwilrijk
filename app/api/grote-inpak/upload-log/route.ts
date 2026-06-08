import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  fetchCaseTypesForLabels,
  resolveLabelDetails,
  type UploadLabelDetail,
} from '@/lib/grote-inpak/upload-log-labels'

export const dynamic = 'force-dynamic'

function collectLabelsFromRows(rows: Array<Record<string, unknown>>): string[] {
  const labels = new Set<string>()
  for (const row of rows) {
    for (const key of ['labels_added', 'labels_removed', 'case_labels'] as const) {
      const list = row[key]
      if (!Array.isArray(list)) continue
      for (const label of list) {
        const trimmed = String(label || '').trim()
        if (trimmed) labels.add(trimmed)
      }
    }
  }
  return [...labels]
}

function mapRowLabels(
  row: Record<string, unknown>,
  typeByLabel: Map<string, string | null>,
  options?: {
    addedDetailKey?: string
    removedDetailKey?: string
    addedLabelsKey?: string
    removedLabelsKey?: string
    singleDetailKey?: string
    singleLabelsKey?: string
  }
) {
  const addedDetailKey = options?.addedDetailKey ?? 'labels_added_detail'
  const removedDetailKey = options?.removedDetailKey ?? 'labels_removed_detail'
  const addedLabelsKey = options?.addedLabelsKey ?? 'labels_added'
  const removedLabelsKey = options?.removedLabelsKey ?? 'labels_removed'

  const labels_added = resolveLabelDetails(
    row[addedDetailKey] as UploadLabelDetail[] | null | undefined,
    row[addedLabelsKey] as string[] | null | undefined,
    typeByLabel
  )
  const labels_removed = resolveLabelDetails(
    row[removedDetailKey] as UploadLabelDetail[] | null | undefined,
    row[removedLabelsKey] as string[] | null | undefined,
    typeByLabel
  )

  if (options?.singleDetailKey || options?.singleLabelsKey) {
    const single = resolveLabelDetails(
      row[options.singleDetailKey ?? 'case_labels_detail'] as UploadLabelDetail[] | null | undefined,
      row[options.singleLabelsKey ?? 'case_labels'] as string[] | null | undefined,
      typeByLabel
    )
    return {
      labels_added: single.length > 0 ? single : null,
      labels_removed,
    }
  }

  return {
    labels_added: labels_added.length > 0 ? labels_added : null,
    labels_removed: labels_removed.length > 0 ? labels_removed : null,
  }
}

export async function GET() {
  try {
    const fetchPils = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_pils_upload_log')
        .select(
          'id, uploaded_at, source_file, cnt_added, cnt_removed, total_records, labels_added, labels_removed, labels_added_detail, labels_removed_detail'
        )
        .order('uploaded_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_pils_upload_log')
          .select('id, uploaded_at, source_file, cnt_added, cnt_removed, total_records, labels_added, labels_removed')
          .order('uploaded_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchForecast = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_forecast_snapshots')
        .select(
          'id, snapshot_at, source_files, total_records, cnt_added, cnt_removed, cnt_date_change, labels_added, labels_removed, labels_added_detail, labels_removed_detail'
        )
        .order('snapshot_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_forecast_snapshots')
          .select('id, snapshot_at, source_files, total_records, cnt_added, cnt_removed, cnt_date_change, labels_added, labels_removed')
          .order('snapshot_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchPacked = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_packed_upload_log')
        .select(
          'id, uploaded_at, source_files, files_count, cnt_added, cnt_updated, total_records, case_types_new, labels_added, labels_removed, labels_added_detail, labels_removed_detail'
        )
        .order('uploaded_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_packed_upload_log')
          .select('id, uploaded_at, source_files, files_count, cnt_added, cnt_updated, total_records, case_types_new, labels_added, labels_removed')
          .order('uploaded_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchKistMailDaily = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_kist_mail_upload_log')
        .select('log_date, mail_count, cases_inserted, cases_updated, case_labels, case_labels_detail, last_event_at')
        .order('last_event_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_kist_mail_upload_log')
          .select('log_date, mail_count, cases_inserted, cases_updated, case_labels, last_event_at')
          .order('last_event_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const [pilsRes, forecastRes, packedRes, kistRes] = await Promise.all([
      fetchPils(),
      fetchForecast(),
      fetchPacked(),
      fetchKistMailDaily(),
    ])

    if (pilsRes.error) throw pilsRes.error
    if (forecastRes.error) throw forecastRes.error
    const packedData = packedRes.error ? [] : (packedRes.data || [])
    const kistData = kistRes.error ? [] : (kistRes.data || [])

    const allRows = [...(pilsRes.data || []), ...(forecastRes.data || []), ...packedData, ...kistData]
    const typeByLabel = await fetchCaseTypesForLabels(supabaseAdmin, collectLabelsFromRows(allRows))

    const pils = (pilsRes.data || []).map((row: any) => {
      const labels = mapRowLabels(row, typeByLabel)
      return {
        id: row.id,
        uploaded_at: row.uploaded_at,
        upload_type: 'pils',
        source: row.source_file || '—',
        cnt_added: row.cnt_added ?? 0,
        cnt_removed: row.cnt_removed ?? 0,
        cnt_updated: null,
        total_records: row.total_records ?? 0,
        cnt_date_change: null,
        case_types_new: null,
        ...labels,
      }
    })

    const forecast = (forecastRes.data || []).map((row: any) => {
      const labels = mapRowLabels(row, typeByLabel)
      return {
        id: row.id,
        uploaded_at: row.snapshot_at,
        upload_type: 'forecast',
        source:
          Array.isArray(row.source_files) && row.source_files.length ? row.source_files.join(', ') : '—',
        cnt_added: row.cnt_added ?? 0,
        cnt_removed: row.cnt_removed ?? 0,
        cnt_updated: null,
        total_records: row.total_records ?? 0,
        cnt_date_change: row.cnt_date_change ?? 0,
        case_types_new: null,
        ...labels,
      }
    })

    const packed = packedData.map((row: any) => {
      const labels = mapRowLabels(row, typeByLabel)
      return {
        id: row.id,
        uploaded_at: row.uploaded_at,
        upload_type: 'packed',
        source: row.source_files || '—',
        cnt_added: row.cnt_added ?? 0,
        cnt_removed: 0,
        cnt_updated: row.cnt_updated ?? 0,
        total_records: row.total_records ?? 0,
        cnt_date_change: null,
        case_types_new:
          Array.isArray(row.case_types_new) && row.case_types_new.length ? row.case_types_new : null,
        ...labels,
      }
    })

    const kist = kistData.map((row: any) => {
      const logDate = row.log_date as string
      const labels = mapRowLabels(row, typeByLabel, {
        singleDetailKey: 'case_labels_detail',
        singleLabelsKey: 'case_labels',
      })
      return {
        id: `kist-daily-${logDate}`,
        uploaded_at: row.last_event_at,
        upload_type: 'kist_mail' as const,
        source: `Kist-mails (dag ${logDate}, Europe/Brussels)`,
        cnt_added: row.cases_inserted ?? 0,
        cnt_removed: 0,
        cnt_updated: row.cases_updated ?? 0,
        total_records: row.mail_count ?? 0,
        cnt_date_change: null,
        case_types_new: null,
        ...labels,
      }
    })

    const merged = [...pils, ...forecast, ...packed, ...kist]
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .slice(0, 200)

    return NextResponse.json({ data: merged })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
