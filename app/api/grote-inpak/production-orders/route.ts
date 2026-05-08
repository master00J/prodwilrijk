import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/grote-inpak/production-orders
 *
 * Geeft alle open productie-orders terug + aggregaties per locatie en per kistnummer.
 * Rijen worden beperkt tot kisten die op dit moment in `grote_inpak_erp_link` staan.
 * Query params:
 *   - location: filter op productielocatie (Genk / Wilrijk / Willebroek)
 *   - kist:     filter op kistnummer
 *   - only_open: 1 = enkel remaining_quantity > 0
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const locationFilter = searchParams.get('location')
    const kistFilter = searchParams.get('kist')
    const onlyOpen = searchParams.get('only_open') === '1'

    let query = supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('*')
      .order('ending_date', { ascending: true, nullsFirst: false })

    if (locationFilter) query = query.eq('productielocatie', locationFilter)
    if (kistFilter) query = query.eq('kistnummer', kistFilter.toUpperCase())
    if (onlyOpen) query = query.gt('remaining_quantity', 0)

    const { data, error } = await query
    if (error) throw error

    const { data: erpRows, error: erpErr } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer')
    if (erpErr) throw erpErr

    const kistenInErpLink = new Set<string>()
    for (const row of erpRows || []) {
      const k = String((row as { kistnummer?: string }).kistnummer ?? '')
        .trim()
        .toUpperCase()
      if (k) kistenInErpLink.add(k)
    }

    const rows = (data || []).filter((r: { kistnummer?: string | null }) => {
      const k = String(r.kistnummer ?? '')
        .trim()
        .toUpperCase()
      return k && kistenInErpLink.has(k)
    })

    const { data: floorRows, error: floorErr } = await supabaseAdmin
      .from('grote_inpak_production_order_floor_status')
      .select('prod_order_no, item_no, bc_source, floor_status, note, updated_at, updated_by')

    if (floorErr) {
      console.warn('production-orders: vloerstatus niet geladen:', floorErr.message)
    }

    const floorMap = new Map<
      string,
      { floor_status: string; note: string | null; updated_at: string; updated_by: string | null }
    >()
    for (const f of floorRows || []) {
      const key = `${f.prod_order_no}\0${f.item_no}\0${f.bc_source}`
      floorMap.set(key, {
        floor_status: f.floor_status,
        note: f.note ?? null,
        updated_at: f.updated_at,
        updated_by: f.updated_by ?? null,
      })
    }

    for (const r of rows as any[]) {
      const key = `${r.prod_order_no}\0${r.item_no}\0${r.bc_source}`
      const fs = floorMap.get(key)
      r.floor_status = fs?.floor_status ?? null
      r.floor_status_note = fs?.note ?? null
      r.floor_status_updated_at = fs?.updated_at ?? null
      r.floor_status_updated_by = fs?.updated_by ?? null
    }
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000

    const stats = {
      total: rows.length,
      open: 0,
      te_laat: 0,
      deze_week: 0,
      remaining_total: 0,
      per_locatie: {
        Genk: { count: 0, remaining: 0 },
        Wilrijk: { count: 0, remaining: 0 },
        Willebroek: { count: 0, remaining: 0 },
      } as Record<'Genk' | 'Wilrijk' | 'Willebroek', { count: number; remaining: number }>,
    }

    // Aggregeren per kistnummer zodat de Kanban/overzicht snel kan matchen.
    const perKist = new Map<string, {
      kistnummer: string
      productielocatie: string | null
      count: number
      remaining_total: number
      earliest_ending: string | null
    }>()

    for (const r of rows) {
      const remaining = Number(r.remaining_quantity ?? 0)
      stats.remaining_total += remaining
      if (remaining > 0) stats.open++

      const loc = r.productielocatie as 'Genk' | 'Wilrijk' | 'Willebroek' | null
      if (loc && stats.per_locatie[loc]) {
        stats.per_locatie[loc].count++
        stats.per_locatie[loc].remaining += remaining
      }

      if (r.ending_date) {
        const t = new Date(r.ending_date).getTime()
        if (!isNaN(t)) {
          if (t < now && remaining > 0) stats.te_laat++
          if (t >= now && t <= now + weekMs && remaining > 0) stats.deze_week++
        }
      }

      if (r.kistnummer) {
        const key = String(r.kistnummer).toUpperCase()
        const entry = perKist.get(key) ?? {
          kistnummer: key,
          productielocatie: loc,
          count: 0,
          remaining_total: 0,
          earliest_ending: null,
        }
        entry.count++
        entry.remaining_total += remaining
        if (r.ending_date) {
          if (!entry.earliest_ending || r.ending_date < entry.earliest_ending) {
            entry.earliest_ending = r.ending_date
          }
        }
        perKist.set(key, entry)
      }
    }

    return NextResponse.json({
      success: true,
      data: rows,
      stats,
      per_kist: Array.from(perKist.values()).sort((a, b) => a.kistnummer.localeCompare(b.kistnummer)),
    })
  } catch (error: any) {
    console.error('Prod orders GET error:', error)
    return NextResponse.json({ error: error.message || 'Fout bij ophalen productie-orders' }, { status: 500 })
  }
}
