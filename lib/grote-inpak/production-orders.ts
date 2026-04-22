import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Haalt per kistnummer ALLE ending_dates van open productie-orders op
 * (enkel rijen met remaining_quantity > 0 tellen mee).
 *
 * Een kisttype kan meerdere lopende productie-order-lijnen hebben, dus we
 * retourneren een array van ISO-datums per kist, gesorteerd van vroegste
 * naar laatste, zonder duplicaten.
 *
 * Gebruikt o.a. in de daily-order Excel-export voor de kolom "Einddatum productie".
 * Geeft een lege Map terug als de tabel niet bestaat of leeg is — callers moeten
 * daar tegen kunnen (geen crash, geen breaking change in de download).
 */
export async function getEndingDatesByKist(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('kistnummer, ending_date, remaining_quantity')
      .gt('remaining_quantity', 0)
      .not('kistnummer', 'is', null)
      .not('ending_date', 'is', null)
      .order('ending_date', { ascending: true })

    if (error) throw error
    for (const row of data || []) {
      const key = String(row.kistnummer || '').toUpperCase().trim()
      if (!key || !row.ending_date) continue
      const iso = String(row.ending_date)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, [iso])
      } else if (!existing.includes(iso)) {
        existing.push(iso)
      }
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
    if (v.length > 0) first.set(k, v[0])
  }
  return first
}
