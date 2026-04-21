import { supabaseAdmin } from '@/lib/supabase/server'

export interface BcMappingLookup {
  /** Zet een oud BC-nummer om naar het nieuwe. Onbekend → input terug. */
  toNew: (code: string | null | undefined) => string
  /** Omgekeerde lookup: nieuw → oud. Onbekend → input terug. */
  toOld: (code: string | null | undefined) => string
  /** Aantal geladen mappings. */
  size: number
}

let cache: { lookup: BcMappingLookup; ts: number } | null = null
const TTL_MS = 5 * 60 * 1000

function buildLookup(rows: Array<{ old_code: string; new_code: string }>): BcMappingLookup {
  const oldToNew = new Map<string, string>()
  const newToOld = new Map<string, string>()
  for (const r of rows) {
    if (!r?.old_code || !r?.new_code) continue
    oldToNew.set(r.old_code.toUpperCase(), r.new_code)
    const newKey = r.new_code.toUpperCase()
    if (!newToOld.has(newKey)) newToOld.set(newKey, r.old_code)
  }
  return {
    size: oldToNew.size,
    toNew: (code) => {
      if (!code) return ''
      const raw = String(code).trim()
      if (!raw) return ''
      return oldToNew.get(raw.toUpperCase()) ?? raw
    },
    toOld: (code) => {
      if (!code) return ''
      const raw = String(code).trim()
      if (!raw) return ''
      return newToOld.get(raw.toUpperCase()) ?? raw
    },
  }
}

/**
 * Laadt de bc_item_mapping tabel in een in-memory lookup.
 * Server-side cache van 5 minuten zodat zware exports (bv. forecast) de DB niet
 * elke keer raken. Bij problemen (geen tabel/connectie) valt terug op een
 * no-op lookup die alle codes ongewijzigd teruggeeft.
 */
export async function getBcMappingLookup(): Promise<BcMappingLookup> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.lookup
  try {
    const pageSize = 1000
    let from = 0
    const all: Array<{ old_code: string; new_code: string }> = []
    // Haal alles in batches op — de tabel kan 6000+ rijen hebben.
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('bc_item_mapping')
        .select('old_code,new_code')
        .range(from, from + pageSize - 1)
      if (error) throw error
      const rows = (data || []) as Array<{ old_code: string; new_code: string }>
      all.push(...rows)
      if (rows.length < pageSize) break
      from += pageSize
    }
    const lookup = buildLookup(all)
    cache = { lookup, ts: Date.now() }
    return lookup
  } catch {
    // Veilige fallback: geen vertalingen, geen crash.
    const lookup = buildLookup([])
    cache = { lookup, ts: Date.now() }
    return lookup
  }
}

/** Handmatig de cache invalideren (bv. na een upload). */
export function invalidateBcMappingCache() {
  cache = null
}
