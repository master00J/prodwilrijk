import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Haalt per kistnummer de vroegste ending_date van een open productie-order op
 * (enkel rijen met remaining_quantity > 0 tellen mee).
 *
 * Gebruikt o.a. in de daily-order Excel-export voor de kolom "Einddatum productie".
 * Geeft een lege Map terug als de tabel niet bestaat of leeg is — callers moeten
 * daar tegen kunnen (geen crash, geen breaking change in de download).
 */
export async function getEndingDateByKist(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('kistnummer, ending_date, remaining_quantity')
      .gt('remaining_quantity', 0)
      .not('kistnummer', 'is', null)
      .not('ending_date', 'is', null)

    if (error) throw error
    for (const row of data || []) {
      const key = String(row.kistnummer || '').toUpperCase().trim()
      if (!key || !row.ending_date) continue
      const current = map.get(key)
      if (!current || row.ending_date < current) {
        map.set(key, row.ending_date as string)
      }
    }
  } catch {
    // Silent fallback — de feature is additief, mag de Excel-export niet breken.
  }
  return map
}
