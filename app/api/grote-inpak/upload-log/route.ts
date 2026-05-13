import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Probeer met labels-kolommen; als die nog niet bestaan (migratie nog niet gerund),
    // val terug op query zonder die kolommen.
    const fetchPils = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_pils_upload_log')
        .select('id, uploaded_at, source_file, cnt_added, cnt_removed, total_records, labels_added, labels_removed')
        .order('uploaded_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_pils_upload_log')
          .select('id, uploaded_at, source_file, cnt_added, cnt_removed, total_records')
          .order('uploaded_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchForecast = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_forecast_snapshots')
        .select('id, snapshot_at, source_files, total_records, cnt_added, cnt_removed, cnt_date_change, labels_added, labels_removed')
        .order('snapshot_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_forecast_snapshots')
          .select('id, snapshot_at, source_files, total_records, cnt_added, cnt_removed, cnt_date_change')
          .order('snapshot_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchPacked = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_packed_upload_log')
        .select('id, uploaded_at, source_files, files_count, cnt_added, cnt_updated, total_records, case_types_new, labels_added, labels_removed')
        .order('uploaded_at', { ascending: false })
        .limit(100)
      if (r.error) {
        return supabaseAdmin
          .from('grote_inpak_packed_upload_log')
          .select('id, uploaded_at, source_files, files_count, cnt_added, cnt_updated, total_records, case_types_new')
          .order('uploaded_at', { ascending: false })
          .limit(100)
      }
      return r
    }

    const fetchKistMailDaily = async () => {
      const r = await supabaseAdmin
        .from('grote_inpak_kist_mail_upload_log')
        .select('log_date, mail_count, cases_inserted, cases_updated, case_labels, last_event_at')
        .order('last_event_at', { ascending: false })
        .limit(100)
      return r
    }

    const [pilsRes, forecastRes, packedRes, kistRes] = await Promise.all([
      fetchPils(),
      fetchForecast(),
      fetchPacked(),
      fetchKistMailDaily(),
    ])

    if (pilsRes.error)    throw pilsRes.error
    if (forecastRes.error) throw forecastRes.error
    // packed / kist-log tabellen mogen nog niet bestaan — dan gewoon leeg
    const packedData = packedRes.error ? [] : (packedRes.data || [])
    const kistData = kistRes.error ? [] : (kistRes.data || [])

    const pils = (pilsRes.data || []).map((row: any) => ({
      id:            row.id,
      uploaded_at:   row.uploaded_at,
      upload_type:   'pils',
      source:        row.source_file || '—',
      cnt_added:     row.cnt_added   ?? 0,
      cnt_removed:   row.cnt_removed ?? 0,
      cnt_updated:   null,
      total_records: row.total_records ?? 0,
      cnt_date_change: null,
      case_types_new:  null,
      labels_added:   row.labels_added   ?? null,
      labels_removed: row.labels_removed ?? null,
    }))

    const forecast = (forecastRes.data || []).map((row: any) => ({
      id:            row.id,
      uploaded_at:   row.snapshot_at,
      upload_type:   'forecast',
      source:        Array.isArray(row.source_files) && row.source_files.length
        ? row.source_files.join(', ')
        : '—',
      cnt_added:     row.cnt_added     ?? 0,
      cnt_removed:   row.cnt_removed   ?? 0,
      cnt_updated:   null,
      total_records: row.total_records ?? 0,
      cnt_date_change: row.cnt_date_change ?? 0,
      case_types_new:  null,
      labels_added:   row.labels_added   ?? null,
      labels_removed: row.labels_removed ?? null,
    }))

    const packed = packedData.map((row: any) => ({
      id:            row.id,
      uploaded_at:   row.uploaded_at,
      upload_type:   'packed',
      source:        row.source_files || '—',
      cnt_added:     row.cnt_added   ?? 0,
      cnt_removed:   0,
      cnt_updated:   row.cnt_updated ?? 0,
      total_records: row.total_records ?? 0,
      cnt_date_change: null,
      case_types_new: Array.isArray(row.case_types_new) && row.case_types_new.length
        ? row.case_types_new : null,
      labels_added:   row.labels_added   ?? null,
      labels_removed: row.labels_removed ?? null,
    }))

    const kist = kistData.map((row: any) => {
      const logDate = row.log_date as string
      return {
        id:            `kist-daily-${logDate}`,
        uploaded_at:   row.last_event_at,
        upload_type:   'kist_mail' as const,
        source:        `Kist-mails (dag ${logDate}, Europe/Brussels)`,
        cnt_added:     row.cases_inserted ?? 0,
        cnt_removed:   0,
        cnt_updated:   row.cases_updated ?? 0,
        total_records: row.mail_count ?? 0,
        cnt_date_change: null,
        case_types_new:  null,
        labels_added:    Array.isArray(row.case_labels) && row.case_labels.length ? row.case_labels : null,
        labels_removed:  null,
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
