import { supabaseAdmin } from '@/lib/supabase/server'

export interface EndingDateEntry {
  /** ISO-datum van de productie-order (ending_date). */
  date: string
  /** Aantal stuks dat nog op deze productie-order openstaat (remaining_quantity). */
  qty: number
}

/**
 * Haalt per kistnummer ALLE open productie-order-lijnen op
 * (enkel rijen met remaining_quantity > 0 tellen mee).
 *
 * Een kisttype kan meerdere lopende productie-order-lijnen hebben (verschillende
 * einddatums en/of verschillende aantallen), dus we retourneren een array van
 * `{ date, qty }`-entries per kist, gesorteerd van vroegste naar laatste datum.
 * Rijen met dezelfde datum worden samengeteld zodat de Excel één regel per
 * unieke datum toont met de totaalhoeveelheid erachter.
 *
 * Gebruikt o.a. in de daily-order Excel-export voor de kolom "Einddatum productie".
 * Geeft een lege Map terug als de tabel niet bestaat of leeg is — callers moeten
 * daar tegen kunnen (geen crash, geen breaking change in de download).
 */
export async function getEndingDatesByKist(): Promise<Map<string, EndingDateEntry[]>> {
  const map = new Map<string, EndingDateEntry[]>()
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('kistnummer, ending_date, remaining_quantity')
      .gt('remaining_quantity', 0)
      .not('kistnummer', 'is', null)
      .not('ending_date', 'is', null)
      .order('ending_date', { ascending: true })

    if (error) throw error

    // Aggregeer per (kist, datum) zodat meerdere PO-lijnen op dezelfde dag
    // samen getoond worden als één regel.
    const agg = new Map<string, Map<string, number>>()
    for (const row of data || []) {
      const key = String(row.kistnummer || '').toUpperCase().trim()
      if (!key || !row.ending_date) continue
      const iso = String(row.ending_date)
      const qty = Number(row.remaining_quantity ?? 0)
      if (!qty) continue
      let inner = agg.get(key)
      if (!inner) { inner = new Map<string, number>(); agg.set(key, inner) }
      inner.set(iso, (inner.get(iso) ?? 0) + qty)
    }

    for (const [key, inner] of agg) {
      const entries: EndingDateEntry[] = Array.from(inner.entries())
        .map(([date, qty]) => ({ date, qty }))
        .sort((a, b) => a.date.localeCompare(b.date))
      map.set(key, entries)
    }
  } catch {
    // Silent fallback — de feature is additief, mag de Excel-export niet breken.
  }
  return map
}

/**
 * Backwards-compatibele variant: geeft enkel de vroegste einddatum per kist terug.
 * Laten staan voor code die alleen de eerste datum nodig heeft.
 */
export async function getEndingDateByKist(): Promise<Map<string, string>> {
  const all = await getEndingDatesByKist()
  const first = new Map<string, string>()
  for (const [k, v] of all) {
    if (v.length > 0) first.set(k, v[0].date)
  }
  return first
}
