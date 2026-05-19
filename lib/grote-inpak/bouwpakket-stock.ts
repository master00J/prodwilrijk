import { supabaseAdmin } from '@/lib/supabase/server'
import {
  formatKistnummerForErpLink,
  normalizeErpCode,
  normalizeKistnummer,
} from '@/lib/utils/erp-code-normalizer'

export type BouwpakketStockQty = {
  genk: number
  wilrijk: number
  willebroek: number
  total: number
}

export type BouwpakketStockContext = {
  kistToBouwpakket: Map<string, string>
  stockByBouwpakket: Map<string, BouwpakketStockQty>
}

const EMPTY_STOCK: BouwpakketStockQty = { genk: 0, wilrijk: 0, willebroek: 0, total: 0 }

function emptyQty(): BouwpakketStockQty {
  return { genk: 0, wilrijk: 0, willebroek: 0, total: 0 }
}

/** Alle gangbare sleutels om een kisttype te matchen met ERP LINK. */
export function kistKeysForBouwpakketLookup(kistRaw: string): string[] {
  const trimmed = formatKistnummerForErpLink(kistRaw)
  if (!trimmed) return []
  const keys = new Set<string>([trimmed])
  const norm = normalizeKistnummer(trimmed)
  if (norm) keys.add(norm)
  const m = trimmed.match(/^([KV])(\d+)$/)
  if (m) {
    const n = parseInt(m[2], 10)
    if (n >= 1 && n <= 99) {
      keys.add(`V${m[2]}`)
      keys.add(`K${m[2]}`)
    } else if (n >= 100) {
      keys.add(`K${m[2]}`)
      keys.add(`V${m[2]}`)
    }
  }
  return [...keys]
}

function normalizeBouwpakketCode(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return normalizeErpCode(trimmed) || trimmed.toUpperCase()
}

function addStockQty(
  map: Map<string, BouwpakketStockQty>,
  code: string,
  location: string,
  qty: number
) {
  if (!code || qty <= 0) return
  if (!map.has(code)) map.set(code, emptyQty())
  const e = map.get(code)!
  const loc = location.toLowerCase()
  if (loc.includes('genk')) e.genk += qty
  else if (loc.includes('wilrijk')) e.wilrijk += qty
  else if (loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl')) e.willebroek += qty
  e.total = e.genk + e.wilrijk + e.willebroek
}

/** Bouwpakket-code + voorraad per locatie uit ERP LINK en stock-tabel. */
export async function fetchBouwpakketStockContext(): Promise<BouwpakketStockContext> {
  const kistToBouwpakket = new Map<string, string>()
  const stockByBouwpakket = new Map<string, BouwpakketStockQty>()
  const bouwpakketCodes = new Set<string>()

  try {
    const [{ data: erpLink }, { data: stockRaw }] = await Promise.all([
      supabaseAdmin.from('grote_inpak_erp_link').select('kistnummer, bouwpakket_code'),
      supabaseAdmin.from('grote_inpak_stock').select('erp_code, item_number, location, quantity'),
    ])

    ;(erpLink || []).forEach((row: { kistnummer?: string; bouwpakket_code?: string }) => {
      const bp = normalizeBouwpakketCode(row.bouwpakket_code)
      if (!bp || !row.kistnummer) return
      bouwpakketCodes.add(bp)
      for (const k of kistKeysForBouwpakketLookup(row.kistnummer)) {
        kistToBouwpakket.set(k, bp)
      }
    })

    ;(stockRaw || []).forEach((s: {
      erp_code?: string
      item_number?: string
      location?: string
      quantity?: number
    }) => {
      const qty = Math.max(0, Number(s.quantity || 0))
      if (qty <= 0) return
      const candidates = [
        s.erp_code ? normalizeErpCode(String(s.erp_code)) : null,
        s.item_number ? normalizeErpCode(String(s.item_number)) : null,
        s.erp_code ? String(s.erp_code).trim().toUpperCase() : null,
        s.item_number ? String(s.item_number).trim().toUpperCase() : null,
      ].filter(Boolean) as string[]

      for (const c of candidates) {
        if (bouwpakketCodes.has(c)) {
          addStockQty(stockByBouwpakket, c, String(s.location || ''), qty)
          return
        }
      }
    })
  } catch (err) {
    console.error('fetchBouwpakketStockContext:', err)
  }

  return { kistToBouwpakket, stockByBouwpakket }
}

export function lookupBouwpakketStock(
  ctx: BouwpakketStockContext,
  caseType: string | null | undefined
): BouwpakketStockQty & { code: string | null } {
  if (!caseType) return { code: null, ...EMPTY_STOCK }
  let bpCode: string | null = null
  for (const k of kistKeysForBouwpakketLookup(caseType)) {
    const found = ctx.kistToBouwpakket.get(k)
    if (found) {
      bpCode = found
      break
    }
  }
  if (!bpCode) return { code: null, ...EMPTY_STOCK }
  const stock =
    ctx.stockByBouwpakket.get(bpCode) ||
    ctx.stockByBouwpakket.get(normalizeErpCode(bpCode) || '') ||
    EMPTY_STOCK
  return { code: bpCode, ...stock }
}

export function enrichRowWithBouwpakketStock<T extends Record<string, unknown>>(
  row: T,
  ctx: BouwpakketStockContext
): T & {
  bouwpakket_code: string
  bouwpakket_stock_genk: number
  bouwpakket_stock_wilrijk: number
  bouwpakket_stock_willebroek: number
  bouwpakket_stock_totaal: number
} {
  const bp = lookupBouwpakketStock(ctx, String(row.case_type || ''))
  return {
    ...row,
    bouwpakket_code: bp.code || '',
    bouwpakket_stock_genk: bp.genk,
    bouwpakket_stock_wilrijk: bp.wilrijk,
    bouwpakket_stock_willebroek: bp.willebroek,
    bouwpakket_stock_totaal: bp.total,
  }
}
