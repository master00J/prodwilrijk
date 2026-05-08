import * as XLSX from 'xlsx'
import { expandWorksheetRef } from '@/lib/xlsx/expand-worksheet-ref'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'

export interface BcShopLineParsed {
  /** Ruwe waarde uit Excel (6-cijferige suffix / shop-key kolom) */
  match_raw: string
  /** Zelfde sleutel als shopOrderMatchKey(PILS serial kolom F) */
  match_key: string | null
  /** BC-kolom Document No. (verkooporder) */
  sales_order_no: string | null
  fp_item_no: string | null
  atlas_planner_email: string | null
  description: string | null
}

const normHeader = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Kolom met laatste 6 cijfers (substr … 11,6), Shop Order Number, of kolom I (index 8). */
function pickSerialSuffixColumn(cells: string[]): number {
  const byHeader = cells.findIndex((h) => /11\s*,\s*6\)|,\s*11\s*,\s*6|at_fores04.*11.*6/i.test(h))
  if (byHeader >= 0) return byHeader
  const shopOrderNo = cells.findIndex((h) => /^shop order\b/.test(h) || h.includes('shop order number'))
  if (shopOrderNo >= 0) return shopOrderNo
  return 8 // kolom I (0-based), fallback
}

function pickAtlasColumn(cells: string[]): number {
  const exact = cells.findIndex((h) => h === 'atlas planner email' || h.includes('atlas planner email'))
  if (exact >= 0) return exact
  const byHeader = cells.findIndex(
    (h) =>
      /atlas.*planner.*(e-?mail|mail)|planner.*(e-?mail|mail)|^e-?mail$|atlasmail|^atlas$/i.test(h) ||
      (h.includes('atlas') && !h.includes('pccrdt')),
  )
  if (byHeader >= 0) return byHeader
  return 7 // kolom H
}

/** Alleen echte e-mail; geen Excel-datums (number/Date) of tekst zonder @. */
function atlasPlannerFromCell(val: unknown): string | null {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) return null
  if (val instanceof Date) return null
  const s = String(val).trim()
  if (!s || !s.includes('@')) return null
  return s
}

function pickDocumentNoColumn(cells: string[]): number {
  const idx = cells.findIndex((h) => h === 'document no.' || h === 'document no' || /^document\s+no\.?$/.test(h))
  if (idx >= 0) return idx
  return 1 // typisch kolom B (Oilfree-export)
}

function pickItemColumn(cells: string[]): number {
  for (let c = 0; c < cells.length; c++) {
    const h = cells[c]
    if (!h) continue
    if (h === 'no.' || h === 'no' || /^item(\s*no\.?)?$/.test(h) || h === 'item number' || h === 'item no.') {
      return c
    }
  }
  return 1 // typisch kolom B
}

/**
 * Oilfree / BC-export: match-sleutel = laatste 6 cijfers (kolom I of kolom met substr …11,6),
 * Atlas Planner e-mail kolom H, FP uit Item No.
 */
export function parseBcShopLinesExcel(workbook: XLSX.WorkBook): BcShopLineParsed[] {
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []
  expandWorksheetRef(ws)

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][]
  if (raw.length < 2) return []

  let headerRow = -1
  let matchCol = -1
  let atlasCol = -1
  let itemCol = -1
  let docCol = -1
  let descCol = -1

  const maxScan = Math.min(25, raw.length)
  for (let r = 0; r < maxScan; r++) {
    const row = raw[r] || []
    const cells = row.map((c) => normHeader(c))
    const hasItemish = cells.some(
      (h) => h === 'no.' || /^item(\s*no\.?)?$/.test(h) || h === 'item number',
    )
    const hasSubstr = cells.some((h) => /substr|at_fores|pccrdt|\d+\s*\+\s*t\d+/i.test(h))
    if (hasItemish && (hasSubstr || cells.length >= 9)) {
      headerRow = r
      matchCol = pickSerialSuffixColumn(cells)
      atlasCol = pickAtlasColumn(cells)
      itemCol = pickItemColumn(cells)
      docCol = pickDocumentNoColumn(cells)
      descCol = cells.findIndex((h) => h === 'description' || h.includes('description'))
      break
    }
  }

  if (headerRow < 0 && raw.length > 4) {
    headerRow = 2
    const cells = (raw[headerRow] || []).map((c) => normHeader(c))
    matchCol = pickSerialSuffixColumn(cells)
    atlasCol = pickAtlasColumn(cells)
    itemCol = pickItemColumn(cells)
    docCol = pickDocumentNoColumn(cells)
    const di = cells.findIndex((h) => h.includes('description'))
    descCol = di >= 0 ? di : -1
  }

  if (headerRow < 0 || matchCol < 0 || itemCol < 0) {
    return []
  }

  const out: BcShopLineParsed[] = []
  for (let r = headerRow + 1; r < raw.length; r++) {
    const row = raw[r] || []
    const matchRaw = String(row[matchCol] ?? '').trim()
    const itemRaw = String(row[itemCol] ?? '').trim()
    if (!matchRaw && !itemRaw) continue
    if (/^no\.?$|^item$/i.test(matchRaw)) continue

    const atlasVal = atlasPlannerFromCell(atlasCol >= 0 ? row[atlasCol] : null)

    const docRaw =
      docCol >= 0 ? String(row[docCol] ?? '').trim() : ''
    const salesOrderNorm = docRaw
      ? docRaw.toUpperCase().replace(/\s+/g, '')
      : null

    const fp = itemRaw ? normalizeErpCode(itemRaw) || itemRaw.toUpperCase().replace(/\s+/g, '') : null
    const desc = descCol >= 0 ? String(row[descCol] ?? '').trim() || null : null

    const match_key = matchRaw ? shopOrderMatchKey(matchRaw) : null
    if (!match_key) continue

    out.push({
      match_raw: matchRaw,
      match_key,
      sales_order_no: salesOrderNorm || null,
      fp_item_no: fp || null,
      atlas_planner_email: atlasVal,
      description: desc,
    })
  }

  return out
}
