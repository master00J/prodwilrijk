import * as XLSX from 'xlsx'
import { expandWorksheetRef } from '@/lib/xlsx/expand-worksheet-ref'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'

export interface BcShopLineParsed {
  shop_order_raw: string
  /** Zelfde normalisatie als PILS serienummer → laatste 6 cijfers */
  shop_key: string | null
  fp_item_no: string | null
  description: string | null
}

const normHeader = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Parseert BC-export (bv. lijnen met Shop order + Item No / FP).
 * Headerrij wordt gezocht in de eerste ~25 rijen (titels boven de tabel mogelijk).
 */
export function parseBcShopLinesExcel(workbook: XLSX.WorkBook): BcShopLineParsed[] {
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []
  expandWorksheetRef(ws)

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][]
  if (raw.length < 2) return []

  let headerRow = -1
  let shopCol = -1
  let itemCol = -1
  let descCol = -1

  const maxScan = Math.min(25, raw.length)
  for (let r = 0; r < maxScan; r++) {
    const row = raw[r] || []
    const cells = row.map((c) => normHeader(c))
    let sc = -1
    let ic = -1
    for (let c = 0; c < cells.length; c++) {
      const h = cells[c]
      if (!h) continue
      if (
        /shop\s*order/.test(h) ||
        (h.includes('shop') && h.includes('order')) ||
        h.includes('verkooporder') ||
        /^sales\s*order/.test(h)
      ) {
        if (sc < 0) sc = c
      }
      if (h === 'no.' || h === 'no' || /^item\s*no\.?$/.test(h) || h === 'item number' || h === 'item no.') {
        if (ic < 0) ic = c
      }
    }
    if (sc >= 0 && ic >= 0) {
      headerRow = r
      shopCol = sc
      itemCol = ic
      descCol = cells.findIndex((h) => h === 'description' || h.includes('description'))
      break
    }
  }

  // Fallback: typisch BC — kop op rij 3 (index 2), data vanaf rij 4; kolom I = shop order (8), B = item
  if (headerRow < 0 && raw.length > 3) {
    headerRow = 2
    shopCol = 8
    itemCol = 1
    descCol = 3
    const hrow = (raw[headerRow] || []).map((c) => normHeader(c))
    const si = hrow.findIndex((h) => /shop|order|verkoop/.test(h))
    const ii = hrow.findIndex((h) => /^no\.?$|item/.test(h))
    if (si >= 0) shopCol = si
    if (ii >= 0) itemCol = ii
    const di = hrow.findIndex((h) => h.includes('description'))
    descCol = di >= 0 ? di : -1
  }

  if (headerRow < 0 || shopCol < 0 || itemCol < 0) {
    return []
  }

  const out: BcShopLineParsed[] = []
  for (let r = headerRow + 1; r < raw.length; r++) {
    const row = raw[r] || []
    const shopRaw = String(row[shopCol] ?? '').trim()
    const itemRaw = String(row[itemCol] ?? '').trim()
    if (!shopRaw && !itemRaw) continue
    // Sla lege of titel-achtige rijen over
    if (/^shop|^item|^no\.?$/i.test(shopRaw)) continue

    const fp = itemRaw ? normalizeErpCode(itemRaw) || itemRaw.toUpperCase().replace(/\s+/g, '') : null
    const desc =
      descCol >= 0 ? String(row[descCol] ?? '').trim() || null : null

    const shop_key = shopRaw ? shopOrderMatchKey(shopRaw) : null
    if (!shop_key) continue

    out.push({
      shop_order_raw: shopRaw,
      shop_key,
      fp_item_no: fp || null,
      description: desc,
    })
  }

  return out
}
