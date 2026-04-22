import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/grote-inpak/production-orders
 *
 * Geeft alle open productie-orders terug + aggregaties per locatie en per kistnummer.
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

    const rows = data || []
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
