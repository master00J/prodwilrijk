export type ItemPalletRow = {
  item: string
  pallet: string
  /** 1-based rij in het werkblad (zoals in Excel) */
  excelRow: number
}

export function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    const rounded = Math.round(value)
    if (Math.abs(value - rounded) < 1e-6) return String(rounded)
    return String(value).trim()
  }
  return String(value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function pairKey(item: string, pallet: string): string {
  return `${item}\t${pallet}`
}

function looksLikeWmsHeader(row: unknown[] | undefined): boolean {
  if (!row?.length) return false
  const a = normalizeCell(row[0]).toLowerCase()
  const b = normalizeCell(row[1]).toLowerCase()
  return a === 'item' || b === 'pallet' || (a.includes('item') && b.includes('pallet'))
}

function looksLikeBcHeader(row: unknown[] | undefined): boolean {
  if (!row?.length) return false
  const e = normalizeCell(row[4]).toLowerCase()
  const p = normalizeCell(row[15]).toLowerCase()
  return e.includes('description') || p.includes('pallet') || p.includes('atlas')
}

/** WMS: kolom A = item, B = pallet (0-based: 0 en 1) */
export function extractFromWmsSheet(rows: unknown[][]): { rows: ItemPalletRow[]; skipped: number } {
  const out: ItemPalletRow[] = []
  let skipped = 0
  let start = 0
  if (rows.length > 0 && looksLikeWmsHeader(rows[0] as unknown[])) start = 1

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[] | undefined
    const item = normalizeCell(row?.[0])
    const pallet = normalizeCell(row?.[1])
    if (!item && !pallet) continue
    if (!item || !pallet) {
      skipped += 1
      continue
    }
    out.push({ item, pallet, excelRow: i + 1 })
  }
  return { rows: out, skipped }
}

/** BC-export: kolom E (4) = item, P (15) = pallet */
export function extractFromBcSheet(rows: unknown[][]): { rows: ItemPalletRow[]; skipped: number } {
  const out: ItemPalletRow[] = []
  let skipped = 0
  let start = 0
  if (rows.length > 0 && looksLikeBcHeader(rows[0] as unknown[])) start = 1

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[] | undefined
    const item = normalizeCell(row?.[4])
    const pallet = normalizeCell(row?.[15])
    if (!item && !pallet) continue
    if (!item || !pallet) {
      skipped += 1
      continue
    }
    out.push({ item, pallet, excelRow: i + 1 })
  }
  return { rows: out, skipped }
}

export type CompareResult = {
  onlyInBc: ItemPalletRow[]
  onlyInWms: ItemPalletRow[]
  matchedUniquePairs: number
  wmsRowCount: number
  bcRowCount: number
}

export function compareWmsAndBc(wmsRows: ItemPalletRow[], bcRows: ItemPalletRow[]): CompareResult {
  const wmsKeys = new Set(wmsRows.map((r) => pairKey(r.item, r.pallet)))
  const bcKeys = new Set(bcRows.map((r) => pairKey(r.item, r.pallet)))

  const onlyInBc = bcRows.filter((r) => !wmsKeys.has(pairKey(r.item, r.pallet)))
  const onlyInWms = wmsRows.filter((r) => !bcKeys.has(pairKey(r.item, r.pallet)))

  let matchedUniquePairs = 0
  for (const k of wmsKeys) {
    if (bcKeys.has(k)) matchedUniquePairs += 1
  }

  return {
    onlyInBc,
    onlyInWms,
    matchedUniquePairs,
    wmsRowCount: wmsRows.length,
    bcRowCount: bcRows.length,
  }
}

export function rowsToCsv(headers: string[], data: Record<string, string | number>[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(esc).join(',')]
  for (const row of data) {
    lines.push(headers.map((h) => esc(row[h] ?? '')).join(','))
  }
  return lines.join('\r\n')
}
