import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [pilsRes, forecastRes] = await Promise.all([
      supabaseAdmin
        .from('grote_inpak_pils_upload_log')
        .select('id, uploaded_at, source_file, cnt_added, cnt_removed, total_records')
        .order('uploaded_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('grote_inpak_forecast_snapshots')
        .select('id, snapshot_at, source_files, total_records, cnt_added, cnt_removed, cnt_date_change')
        .order('snapshot_at', { ascending: false })
        .limit(100),
    ])

    if (pilsRes.error) throw pilsRes.error
    if (forecastRes.error) throw forecastRes.error

    const pils = (pilsRes.data || []).map((row: any) => ({
      id: row.id,
      uploaded_at: row.uploaded_at,
      upload_type: 'pils',
      source: row.source_file || '—',
      cnt_added: row.cnt_added ?? 0,
      cnt_removed: row.cnt_removed ?? 0,
      total_records: row.total_records ?? 0,
      cnt_date_change: null,
    }))

    const forecast = (forecastRes.data || []).map((row: any) => ({
      id: row.id,
      uploaded_at: row.snapshot_at,
      upload_type: 'forecast',
      source: Array.isArray(row.source_files) && row.source_files.length
        ? row.source_files.join(', ')
        : '—',
      cnt_added: row.cnt_added ?? 0,
      cnt_removed: row.cnt_removed ?? 0,
      total_records: row.total_records ?? 0,
      cnt_date_change: row.cnt_date_change ?? 0,
    }))

    const merged = [...pils, ...forecast].sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    ).slice(0, 100)

    return NextResponse.json({ data: merged })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
