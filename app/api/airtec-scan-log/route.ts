import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── POST: log één scan event ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lot_number, scan_a_raw, scan_b_raw, result, item_id, error_message } = body

    if (!result || !['match', 'mismatch', 'error'].includes(result)) {
      return NextResponse.json({ error: 'Ongeldig result veld' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('airtec_scan_log')
      .insert({
        lot_number:    lot_number    ?? null,
        scan_a_raw:    scan_a_raw    ?? null,
        scan_b_raw:    scan_b_raw    ?? null,
        result,
        item_id:       item_id       ?? null,
        error_message: error_message ?? null,
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── GET: haal scan log op met filters ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sp     = request.nextUrl.searchParams
    const result = sp.get('result')        // 'match' | 'mismatch' | 'error' | null = alle
    const from   = sp.get('from')          // ISO date string
    const to     = sp.get('to')
    const limit  = Math.min(parseInt(sp.get('limit') ?? '500'), 1000)

    let query = supabaseAdmin
      .from('airtec_scan_log')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit)

    if (result) query = query.eq('result', result)
    if (from)   query = query.gte('scanned_at', from)
    if (to)     query = query.lte('scanned_at', to)

    const { data, error } = await query
    if (error) throw error

    // Bereken samenvattende statistieken
    const statsQuery = supabaseAdmin
      .from('airtec_scan_log')
      .select('result, scanned_at')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [allRes, todayRes] = await Promise.all([
      supabaseAdmin
        .from('airtec_scan_log')
        .select('result')
        .gte('scanned_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
      supabaseAdmin
        .from('airtec_scan_log')
        .select('result')
        .gte('scanned_at', today.toISOString()),
    ])

    const countBy = (rows: any[], r: string) => (rows ?? []).filter(x => x.result === r).length

    return NextResponse.json({
      data: data ?? [],
      stats: {
        last30days: {
          total:    (allRes.data ?? []).length,
          match:    countBy(allRes.data ?? [], 'match'),
          mismatch: countBy(allRes.data ?? [], 'mismatch'),
          error:    countBy(allRes.data ?? [], 'error'),
        },
        today: {
          total:    (todayRes.data ?? []).length,
          match:    countBy(todayRes.data ?? [], 'match'),
          mismatch: countBy(todayRes.data ?? [], 'mismatch'),
          error:    countBy(todayRes.data ?? [], 'error'),
        },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
