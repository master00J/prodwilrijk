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

/** Items-to-pack-nummer komt in BC-omschrijving voor tussen haakjes, bv. (2204200205) */
function descriptionContainsPackedItemInBrackets(blob: string, packedItemNumber: string): boolean {
  const p = String(packedItemNumber || '').trim()
  if (!p || !blob) return false
  const inner = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\(${inner}\\)`, 'i').test(blob)
}

function stageConsumptionFromLineDescription(description: string | null | undefined, description2: string | null | undefined, packedAmount: number) {
  const m = new Map<string, number>()
  const amt = Math.max(1, Math.round(Number(packedAmount) || 1))
  const blob = `${description || ''}\n${description2 || ''}`

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
 * Als `packedItemNumber` gezet is (van items_to_pack): alleen afboeken als dat nummer
 * in dezelfde description/description_2 tussen haakjes staat én daar ook STAGE voorkomt —
 * zoals op de Airtec-kistenvoorraad (kist 193).
 *
 * Zonder packedItemNumber: oude gedrag (componenten eerst, dan omschrijving).
 */
export function stageConsumptionForOrderLine(
  line: any,
  packedAmount: number,
  packedItemNumber?: string | null
): Map<string, number> {
  const pack = packedItemNumber != null ? String(packedItemNumber).trim() : ''

  if (pack) {
    const blob = `${line.description || ''}\n${line.description_2 || ''}`
    if (!descriptionContainsPackedItemInBrackets(blob, pack)) return new Map()
    if (!hasStage(blob)) return new Map()
    return stageConsumptionFromLineDescription(line.description, line.description_2, packedAmount)
  }

  const fromComp = stageConsumptionFromComponents(line.production_order_components, packedAmount)
  if (fromComp.size > 0) return fromComp
  return stageConsumptionFromLineDescription(line.description, line.description_2, packedAmount)
}

type LineRow = {
  id: number
  item_number: string | null
  description: string | null
  description_2: string | null
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

  const itemNum = (raw.item_number as string | null | undefined) ?? null
  const itemNo = (raw.item_no as string | null | undefined) ?? null

  return {
    id: Number(raw.id),
    /** Zelfde artikelcode als in items_to_pack: vaak in item_no (BC), soms ook in item_number */
    item_number: itemNum ?? itemNo,
    description: (raw.description as string | null) ?? null,
    description_2: (raw.description_2 as string | null) ?? null,
    production_orders,
    production_order_components,
  }
}

/** Artikelnummer tussen haakjes aan het einde van de (laatste) regel — zoals op items_to_pack */
function extractTrailingBracketItemNo(desc: string | null | undefined): string | null {
  if (!desc) return null
  const s = String(desc).trim()
  let m = s.match(/\(([^)]+)\)\s*$/)
  if (m?.[1]) return m[1].trim()
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    m = lines[i].match(/\(([^)]+)\)\s*$/)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

/**
 * Alle lookup-keys voor één orderregel: item_number/item_no + nummer uit haakjes in description.
 * Zo matcht items_to_pack "2204200205" op een regel waar de omschrijving eindigt op "(2204200205)".
 */
function buildLineLookupMap(lines: LineRow[]): Map<string, LineRow> {
  const deduped = new Map<number, LineRow>()
  for (const line of lines) {
    deduped.set(line.id, line)
  }
  const uniqueLines = [...deduped.values()]

  const best = new Map<string, { line: LineRow; uploaded: string }>()
  const consider = (rawKey: string | null | undefined, line: LineRow) => {
    const k = normalizeItemNumber(rawKey)
    if (!k) return
    const uploaded = line.production_orders?.uploaded_at || ''
    const prev = best.get(k)
    if (!prev || uploaded > prev.uploaded) best.set(k, { line, uploaded })
  }

  for (const line of uniqueLines) {
    consider(line.item_number, line)
    const b1 = extractTrailingBracketItemNo(line.description)
    if (b1) consider(b1, line)
    const b2 = extractTrailingBracketItemNo(line.description_2)
    if (b2) consider(b2, line)
  }

  return new Map([...best.entries()].map(([k, v]) => [k, v.line]))
}

const SELECT_PRODUCTION_LINE = `
        id,
        item_no,
        item_number,
        description,
        description_2,
        production_orders (uploaded_at),
        production_order_components (
          component_item_no,
          component_description,
          component_description_2,
          component_unit
        )
      `

async function fetchLinesByBracketInDescription(itemNumbers: string[]): Promise<LineRow[]> {
  const unique = [...new Set(itemNumbers.map((s) => String(s || '').trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const byId = new Map<number, LineRow>()
  const CHUNK = 10
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const orParts: string[] = []
    for (const u of chunk) {
      orParts.push(`description.ilike.%(${u})%`)
      orParts.push(`description_2.ilike.%(${u})%`)
    }
    const { data, error } = await supabaseAdmin
      .from('production_order_lines')
      .select(SELECT_PRODUCTION_LINE)
      .or(orParts.join(','))

    if (error) {
      console.error('fetchLinesByBracketInDescription:', error)
      continue
    }
    ;(data || []).forEach((row: any) => {
      byId.set(Number(row.id), normalizeFetchedOrderLine(row as Record<string, unknown>))
    })
  }
  return [...byId.values()]
}

export async function fetchLatestBomLinesByItemNumber(itemNumbers: string[]): Promise<Map<string, LineRow>> {
  const rawCandidates = itemNumbers
    .map((n) => String(n || '').trim())
    .filter(Boolean)

  const candidates = Array.from(
    new Set(rawCandidates.flatMap((n) => [n, normalizeItemNumber(n)].filter(Boolean)))
  )
  if (candidates.length === 0) return new Map()

  const allLines: LineRow[] = []
  const BATCH = 80
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const byId = new Map<number, Record<string, unknown>>()

    const { data: byItemNumber, error: err1 } = await supabaseAdmin
      .from('production_order_lines')
      .select(SELECT_PRODUCTION_LINE)
      .in('item_number', batch)

    if (err1) console.error('fetchLatestBomLinesByItemNumber (item_number):', err1)
    else (byItemNumber || []).forEach((row: any) => byId.set(Number(row.id), row))

    const { data: byItemNo, error: err2 } = await supabaseAdmin
      .from('production_order_lines')
      .select(SELECT_PRODUCTION_LINE)
      .in('item_no', batch)

    if (err2) console.error('fetchLatestBomLinesByItemNumber (item_no):', err2)
    else (byItemNo || []).forEach((row: any) => byId.set(Number(row.id), row))

    if (byId.size > 0) {
      allLines.push(...[...byId.values()].map(normalizeFetchedOrderLine))
    }
  }

  let map = buildLineLookupMap(allLines)

  const wantKeys = new Set(rawCandidates.map((n) => normalizeItemNumber(n)).filter(Boolean))
  const unmatched = [...wantKeys].filter((k) => !map.has(k))
  if (unmatched.length > 0) {
    const extra = await fetchLinesByBracketInDescription(unmatched)
    if (extra.length > 0) {
      const byId = new Map<number, LineRow>()
      allLines.forEach((l) => byId.set(l.id, l))
      extra.forEach((l) => byId.set(l.id, l))
      map = buildLineLookupMap([...byId.values()])
    }
  }

  return map
}

export async function consumeAirtecKistenStockForStageErpCodes(consumption: Map<string, number>) {
  for (const [erpOrKist, qty] of consumption) {
    if (!erpOrKist || qty <= 0) continue
    try {
      const code = String(erpOrKist).trim()
      const { data: rows } = await supabaseAdmin
        .from('airtec_kisten_stock')
        .select('id, kistnummer, huidige_voorraad')
        .or(`erp_code.eq.${code},kistnummer.eq.${code}`)
        .limit(1)

      const row = rows?.[0]
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
