import { supabaseAdmin } from '@/lib/supabase/server'

const normalizeItemNumber = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim().toUpperCase()
}

const hasStage = (text: string) => /\bSTAGE\b/i.test(text)

/**
 * Kistnummer = cijfer na "STAGE" (zoals op voorraad), bv. "STAGE 193" → "193".
 * Niet het artikelnummer tussen haakjes.
 */
const kistnummerFromStageText = (text: string): string | null => {
  const m = text.match(/\bSTAGE\s+(\d+)\b/i)
  return m?.[1]?.trim() ?? null
}

function kistnummerFromStageBlob(blob: string): string | null {
  for (const line of blob.split(/\r?\n/)) {
    const k = kistnummerFromStageText(line)
    if (k) return k
  }
  return kistnummerFromStageText(blob)
}

/** Fallback: oude patroon met ERP tussen haakjes aan het eind van een STAGE-regel */
const legacyErpFromStageLine = (line: string) => {
  if (!hasStage(line)) return null
  const m = line.match(/\((\d+)\)\s*$/)
  return m?.[1]?.trim() ?? null
}

function stageConsumptionFromComponents(components: any[] | null | undefined, packedAmount: number) {
  const m = new Map<string, number>()
  const amt = Math.max(1, Math.round(Number(packedAmount) || 1))
  for (const comp of components || []) {
    const blob = `${comp.component_description || ''}\n${comp.component_description_2 || ''}`
    if (!hasStage(blob)) continue

    let code = kistnummerFromStageBlob(blob)
    if (!code) {
      for (const line of blob.split(/\r?\n/)) {
        if (!hasStage(line)) continue
        code = legacyErpFromStageLine(line)
        if (code) break
      }
    }
    if (!code) continue

    const unit = Number(comp.component_unit)
    const perParent = Number.isFinite(unit) && unit > 0 ? unit : 1
    m.set(code, (m.get(code) || 0) + Math.round(perParent * amt))
  }
  return m
}

/** Itemnummer staat in description: tussen haakjes en/of als afzonderlijk token */
function descriptionReferencesPackedItem(desc: string | null | undefined, packedItemNumber: string): boolean {
  const blob = String(desc || '').trim()
  const p = String(packedItemNumber || '').trim()
  if (!blob || !p) return false
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`\\(${esc}\\)`, 'i').test(blob)) return true
  return new RegExp(`\\b${esc}\\b`, 'i').test(blob)
}

function stageConsumptionFromLineDescription(description: string | null | undefined, packedAmount: number) {
  const m = new Map<string, number>()
  const amt = Math.max(1, Math.round(Number(packedAmount) || 1))
  const blob = String(description || '').trim()

  const reStage = /\bSTAGE\s+(\d+)\b/gi
  let match: RegExpExecArray | null
  while ((match = reStage.exec(blob)) !== null) {
    const code = match[1]?.trim()
    if (code) m.set(code, (m.get(code) || 0) + amt)
  }

  if (m.size === 0) {
    for (const line of blob.split(/\r?\n/)) {
      if (!hasStage(line)) continue
      let code = kistnummerFromStageText(line) || legacyErpFromStageLine(line)
      if (!code) continue
      m.set(code, (m.get(code) || 0) + amt)
    }
  }

  return m
}

function mergeMaps(target: Map<string, number>, add: Map<string, number>) {
  add.forEach((v, k) => target.set(k, (target.get(k) || 0) + v))
}

/**
 * Bepaalt welke kistnummers (STAGE n → n) af te boeken zijn voor één productieorderregel.
 *
 * Met `packedItemNumber` (items_to_pack): alleen kolom **description** — dat nummer moet
 * daar voorkomen (haakjes of woordgrens) én **STAGE** met kistnummer in diezelfde tekst;
 * dan afboeken op Airtec-voorraad (bv. STAGE 193 → kist 193).
 *
 * Zonder packedItemNumber: componenten eerst, anders description.
 */
export function stageConsumptionForOrderLine(
  line: any,
  packedAmount: number,
  packedItemNumber?: string | null
): Map<string, number> {
  const pack = packedItemNumber != null ? String(packedItemNumber).trim() : ''

  if (pack) {
    const desc = line.description as string | null | undefined
    if (!descriptionReferencesPackedItem(desc, pack)) return new Map()
    if (!hasStage(String(desc || ''))) return new Map()
    return stageConsumptionFromLineDescription(desc, packedAmount)
  }

  const fromComp = stageConsumptionFromComponents(line.production_order_components, packedAmount)
  if (fromComp.size > 0) return fromComp
  return stageConsumptionFromLineDescription(line.description, packedAmount)
}

type LineRow = {
  id: number
  description: string | null
  production_orders: { uploaded_at: string | null } | null
  production_order_components: any[] | null
}

/** Supabase typt geneste many-to-one soms als object, soms als enkel-element-array */
function normalizeFetchedOrderLine(raw: Record<string, unknown>): LineRow {
  const po = raw.production_orders as
    | { uploaded_at?: string | null }
    | { uploaded_at?: string | null }[]
    | null
    | undefined

  let production_orders: { uploaded_at: string | null } | null = null
  if (Array.isArray(po) && po[0] && typeof po[0] === 'object') {
    production_orders = { uploaded_at: (po[0] as { uploaded_at?: string | null }).uploaded_at ?? null }
  } else if (po && typeof po === 'object' && !Array.isArray(po)) {
    production_orders = { uploaded_at: (po as { uploaded_at?: string | null }).uploaded_at ?? null }
  }

  const comps = raw.production_order_components
  const production_order_components = Array.isArray(comps) ? comps : comps != null ? [comps] : null

  return {
    id: Number(raw.id),
    description: (raw.description as string | null) ?? null,
    production_orders,
    production_order_components,
  }
}

const SELECT_PRODUCTION_LINE = `
        id,
        description,
        production_orders (uploaded_at),
        production_order_components (
          component_item_no,
          component_description,
          component_description_2,
          component_unit
        )
      `

/** ILIKE-patroon: % en _ escapen voor PostgREST */
function escapeIlikePattern(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Haal alle orderregels waar description het klant-itemnummer (substring) bevat */
async function fetchLinesWhereDescriptionMentionsAny(itemNumbers: string[]): Promise<LineRow[]> {
  const unique = [...new Set(itemNumbers.map((s) => String(s || '').trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const byId = new Map<number, LineRow>()
  const CHUNK = 10
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const orParts = chunk.map((u) => {
      const safe = escapeIlikePattern(u)
      return `description.ilike.%${safe}%`
    })
    const { data, error } = await supabaseAdmin
      .from('production_order_lines')
      .select(SELECT_PRODUCTION_LINE)
      .or(orParts.join(','))

    if (error) {
      console.error('fetchLinesWhereDescriptionMentionsAny:', error)
      continue
    }
    ;(data || []).forEach((row: any) => {
      byId.set(Number(row.id), normalizeFetchedOrderLine(row as Record<string, unknown>))
    })
  }
  return [...byId.values()]
}

/**
 * Koppel elk items-to-pack itemnummer aan de meest recente orderregel waarvan **description**
 * dat nummer bevat (volgens dezelfde regels als bij afboeken). Geen item_no / item_number op de regel.
 */
function buildLookupMapFromLinesAndCandidates(lines: LineRow[], rawCandidates: string[]): Map<string, LineRow> {
  const deduped = new Map<number, LineRow>()
  for (const line of lines) {
    deduped.set(line.id, line)
  }
  const uniqueLines = [...deduped.values()]

  const best = new Map<string, { line: LineRow; uploaded: string }>()

  for (const raw of rawCandidates) {
    const key = normalizeItemNumber(raw)
    if (!key) continue
    for (const line of uniqueLines) {
      if (!descriptionReferencesPackedItem(line.description, raw)) continue
      const uploaded = line.production_orders?.uploaded_at || ''
      const prev = best.get(key)
      if (!prev || uploaded > prev.uploaded) best.set(key, { line, uploaded })
    }
  }

  return new Map([...best.entries()].map(([k, v]) => [k, v.line]))
}

export async function fetchLatestBomLinesByItemNumber(itemNumbers: string[]): Promise<Map<string, LineRow>> {
  const rawUnique = [...new Set(itemNumbers.map((n) => String(n || '').trim()).filter(Boolean))]
  if (rawUnique.length === 0) return new Map()

  const lines = await fetchLinesWhereDescriptionMentionsAny(rawUnique)
  return buildLookupMapFromLinesAndCandidates(lines, rawUnique)
}

/**
 * Boekt stage-kisten af in airtec_kisten_stock voor klaargemelde prepack-items.
 *
 * Voor sommige STAGE-nummers bestaan er 2 varianten:
 *   - "195"     → Airtec-variant (bv. ERP GP005717)
 *   - "195 klp" → Prepack-variant (bv. ERP GP005670)
 * Omdat deze functie alleen vanuit de PREPACK klaarmeld-flow (items-to-pack)
 * wordt aangeroepen, krijgt de "klp"-variant voorrang zodra die bestaat.
 * Zonder klp-variant valt hij terug op de gewone kist (zoals voorheen).
 */
export async function consumeAirtecKistenStockForStageErpCodes(consumption: Map<string, number>) {
  for (const [erpOrKist, qty] of consumption) {
    if (!erpOrKist || qty <= 0) continue
    try {
      const code = String(erpOrKist).trim()

      // 1) Zoek eerst naar een prepack-variant: kistnummer ILIKE "<code> klp" (spatie + klp/kip, case-insensitive)
      type StockRow = { id: number; kistnummer: string | null; huidige_voorraad: number | null }
      let row: StockRow | null = null

      const { data: prepackRows } = await supabaseAdmin
        .from('airtec_kisten_stock')
        .select('id, kistnummer, huidige_voorraad')
        .or(`kistnummer.ilike.${code} klp,kistnummer.ilike.${code} kip`)
        .limit(1)

      if (prepackRows && prepackRows.length > 0) {
        row = prepackRows[0] as unknown as StockRow
      } else {
        // 2) Fallback: zoek de gewone kist op kistnummer of erp_code
        const { data: rows } = await supabaseAdmin
          .from('airtec_kisten_stock')
          .select('id, kistnummer, huidige_voorraad')
          .or(`erp_code.eq.${code},kistnummer.eq.${code}`)
          .limit(1)
        row = (rows?.[0] as unknown as StockRow) ?? null
      }

      if (!row?.id) continue

      const kist = String(row.kistnummer || code).trim()
      const newStock = Math.max(0, (row.huidige_voorraad || 0) - qty)
      await supabaseAdmin
        .from('airtec_kisten_stock')
        .update({ huidige_voorraad: newStock, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      await supabaseAdmin.from('airtec_kisten_stock_log').insert({
        kistnummer: kist,
        change_type: 'consumed',
        quantity: qty,
      })
    } catch {
      /* stock-tabellen ontbreken mogelijk */
    }
  }
}

export async function consumeStageKistenForPackedPowertoolsItems(
  items: { item_number: string | null | undefined; amount: number | null | undefined }[]
) {
  const nums = items.map((i) => String(i.item_number || '').trim()).filter(Boolean)
  if (nums.length === 0) return

  const lineByItem = await fetchLatestBomLinesByItemNumber(nums)
  const total = new Map<string, number>()

  for (const item of items) {
    const key = normalizeItemNumber(item.item_number)
    if (!key) continue
    const line = lineByItem.get(key)
    if (!line) continue
    const part = stageConsumptionForOrderLine(line, Number(item.amount) || 1, item.item_number)
    mergeMaps(total, part)
  }

  await consumeAirtecKistenStockForStageErpCodes(total)
}

export async function aggregateStageKistenNeedForQueue(
  queueItems: { item_number: string | null | undefined; amount: number | null | undefined }[]
) {
  const nums = queueItems.map((i) => String(i.item_number || '').trim()).filter(Boolean)
  const lineByItem = await fetchLatestBomLinesByItemNumber(nums)
  const totals = new Map<string, number>()
  const perItem: { item_number: string; amount: number; erp_codes: { code: string; qty: number }[] }[] = []

  for (const item of queueItems) {
    const raw = String(item.item_number || '').trim()
    const key = normalizeItemNumber(raw)
    if (!key) continue
    const line = lineByItem.get(key)
    const m = line
      ? stageConsumptionForOrderLine(line, Number(item.amount) || 1, item.item_number)
      : new Map<string, number>()
    const erp_codes = [...m.entries()].map(([code, qty]) => ({ code, qty }))
    m.forEach((v, k) => totals.set(k, (totals.get(k) || 0) + v))
    perItem.push({ item_number: raw, amount: Number(item.amount) || 1, erp_codes })
  }

  return {
    totals: Object.fromEntries([...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    perItem,
  }
}
