import { supabaseAdmin } from '@/lib/supabase/server'

const normalizeItemNumber = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim().toUpperCase()
}

const hasStage = (text: string) => /\bSTAGE\b/i.test(text)

/** ERP-code uit haakjes aan het einde van een STAGE-regel, bv. "... STAGE 191 (1127380796)" */
const erpFromStageLine = (line: string) => {
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

    const itemNo = String(comp.component_item_no || '').trim()
    let code: string | null = /^\d+$/.test(itemNo) ? itemNo : null
    if (!code) {
      for (const line of blob.split(/\r?\n/)) {
        code = erpFromStageLine(line)
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

function stageConsumptionFromLineDescription(description: string | null | undefined, description2: string | null | undefined, packedAmount: number) {
  const m = new Map<string, number>()
  const amt = Math.max(1, Math.round(Number(packedAmount) || 1))
  const blob = `${description || ''}\n${description2 || ''}`
  for (const line of blob.split(/\r?\n/)) {
    const code = erpFromStageLine(line)
    if (!code) continue
    m.set(code, (m.get(code) || 0) + amt)
  }
  return m
}

function mergeMaps(target: Map<string, number>, add: Map<string, number>) {
  add.forEach((v, k) => target.set(k, (target.get(k) || 0) + v))
}

export function stageConsumptionForOrderLine(line: any, packedAmount: number): Map<string, number> {
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

function pickLatestLinePerItem(lines: LineRow[]): Map<string, LineRow> {
  const best = new Map<string, LineRow>()
  for (const line of lines) {
    const key = normalizeItemNumber(line.item_number)
    if (!key) continue
    const uploaded = line.production_orders?.uploaded_at || ''
    const prev = best.get(key)
    if (!prev) {
      best.set(key, line)
      continue
    }
    const prevU = prev.production_orders?.uploaded_at || ''
    if (uploaded > prevU) best.set(key, line)
  }
  return best
}

export async function fetchLatestBomLinesByItemNumber(itemNumbers: string[]): Promise<Map<string, LineRow>> {
  const candidates = Array.from(
    new Set(
      itemNumbers
        .map((n) => String(n || '').trim())
        .filter(Boolean)
        .flatMap((n) => [n, normalizeItemNumber(n)].filter(Boolean))
    )
  )
  if (candidates.length === 0) return new Map()

  const allLines: LineRow[] = []
  const BATCH = 80
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const selectLines = `
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

    const byId = new Map<number, Record<string, unknown>>()

    const { data: byItemNumber, error: err1 } = await supabaseAdmin
      .from('production_order_lines')
      .select(selectLines)
      .in('item_number', batch)

    if (err1) console.error('fetchLatestBomLinesByItemNumber (item_number):', err1)
    else (byItemNumber || []).forEach((row: any) => byId.set(Number(row.id), row))

    const { data: byItemNo, error: err2 } = await supabaseAdmin
      .from('production_order_lines')
      .select(selectLines)
      .in('item_no', batch)

    if (err2) console.error('fetchLatestBomLinesByItemNumber (item_no):', err2)
    else (byItemNo || []).forEach((row: any) => byId.set(Number(row.id), row))

    if (byId.size > 0) {
      allLines.push(...[...byId.values()].map(normalizeFetchedOrderLine))
    }
  }

  return pickLatestLinePerItem(allLines)
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
    const part = stageConsumptionForOrderLine(line, Number(item.amount) || 1)
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
    const m = line ? stageConsumptionForOrderLine(line, Number(item.amount) || 1) : new Map<string, number>()
    const erp_codes = [...m.entries()].map(([code, qty]) => ({ code, qty }))
    m.forEach((v, k) => totals.set(k, (totals.get(k) || 0) + v))
    perItem.push({ item_number: raw, amount: Number(item.amount) || 1, erp_codes })
  }

  return {
    totals: Object.fromEntries([...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    perItem,
  }
}
