import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Cache 5 minuten op Vercel: de mapping verandert zelden (alleen bij expliciete
// re-import door een admin). Op client-kant wordt er nog extra sessionStorage-
// cache bovenop gelegd.
export const revalidate = 300

interface MappingRow {
  old_code: string
  new_code: string
  description: string | null
}

// Publieke GET: levert de volledige mapping-lijst zodat de client een in-memory
// lookup kan bouwen. Geen auth vereist — het gaat enkel om een publieke
// artikelnummer-vertaaltabel.
//
// BELANGRIJK: Supabase/PostgREST cap't standaard op 1000 rijen per request
// (ongeacht .limit()). De mapping kan 6000+ rijen bevatten, dus pagineren we
// expliciet via .range() tot we alles hebben.
export async function GET() {
  try {
    const pageSize = 1000
    let from = 0
    const all: MappingRow[] = []
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('bc_item_mapping')
        .select('old_code,new_code,description')
        .order('old_code', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw error
      const rows = (data || []) as MappingRow[]
      all.push(...rows)
      if (rows.length < pageSize) break
      from += pageSize
      // veiligheidsgrens
      if (all.length > 100_000) break
    }
    return NextResponse.json({ mappings: all })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg, mappings: [] }, { status: 500 })
  }
}
