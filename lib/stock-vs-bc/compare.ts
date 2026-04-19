import * as XLSX from 'xlsx'

export interface CompareRow {
  item_number: string
  bc_qty: number
  telling_qty: number
  diff: number // bc - telling
  status: 'match' | 'te_versturen' | 'extra_in_stock' | 'enkel_bc' | 'enkel_telling'
}

/**
 * Normaliseer een itemnummer: enkel cijfers. Retourneert null als er geen
 * zinnige numerieke waarde is, of als het resultaat geen 10 cijfers is.
 *
 * Opmerking: sommige BC-cellen bevatten per ongeluk 2x hetzelfde nummer
 * achter elkaar (bv. "22042394224648712204239422464871" = 2x 16 digits,
 * of dubbele 10-cijferige reeksen). We proberen daar pragmatisch mee om te
 * gaan door bij 20 cijfers te testen of de twee helften identiek zijn, en
 * zo ja enkel de eerste helft te gebruiken.
 */
export function normalizeItemNumber(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const digits = s.replace(/\D+/g, '')
  if (!digits) return null

  // Exact 10 cijfers → normaal geval
  if (digits.length === 10) return digits

  // 20 cijfers waarbij beide helften gelijk zijn → dubbele plak, neem eerste helft
  if (digits.length === 20) {
    const a = digits.slice(0, 10)
    const b = digits.slice(10)
    if (a === b) return a
  }

  // Voor langere reeksen: probeer de laatste 10 cijfers (bij BC zien we soms
  // een prefix/nummer-concatenatie; het echte itemnummer is dan achteraan).
  // We vereisen wel dat de reeks een veelvoud is van 10 én dat alle
  // 10-cijferige blokken identiek zijn (anders is het waarschijnlijk geen
  // itemnummer maar een andere identifier).
  if (digits.length > 10 && digits.length % 10 === 0) {
    const blocks: string[] = []
    for (let i = 0; i < digits.length; i += 10) {
      blocks.push(digits.slice(i, i + 10))
    }
    if (blocks.every((b) => b === blocks[0])) return blocks[0]
  }

  return null
}

/**
 * Parseer het BC stock-Excel bestand.
 * - Elke rij = 1 stuk.
 * - Het itemnummer staat standaard in kolom E (index 4).
 * - De header-rij wordt automatisch overgeslagen als de eerste rij geen
 *   geldig itemnummer bevat.
 */
export function parseBcSheet(
  rows: unknown[][],
  itemColumnIndex = 4
): { counts: Map<string, number>; skippedRows: number; headerRow: unknown[] | null } {
  const counts = new Map<string, number>()
  let skippedRows = 0
  let headerRow: unknown[] | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const raw = row[itemColumnIndex]
    const item = normalizeItemNumber(raw)
    if (!item) {
      if (i === 0) headerRow = row
      skippedRows++
      continue
    }
    counts.set(item, (counts.get(item) || 0) + 1)
  }

  return { counts, skippedRows, headerRow }
}

/**
 * Parseer het stock-telling Excel bestand (tab "Overzicht" of eerste tab
 * als die niet bestaat). Itemnummer in kolom A (0), Aantal in kolom C (2).
 */
export function parseTellingSheet(
  rows: unknown[][],
  itemColumnIndex = 0,
  qtyColumnIndex = 2
): { totals: Map<string, number>; skippedRows: number } {
  const totals = new Map<string, number>()
  let skippedRows = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const raw = row[itemColumnIndex]
    const item = normalizeItemNumber(raw)
    if (!item) {
      skippedRows++
      continue
    }
    const qtyRaw = row[qtyColumnIndex]
    const qty = Number(qtyRaw)
    if (!Number.isFinite(qty) || qty <= 0) {
      skippedRows++
      continue
    }
    totals.set(item, (totals.get(item) || 0) + qty)
  }

  return { totals, skippedRows }
}

/**
 * Vergelijk beide totalen. Geeft één regel per uniek itemnummer.
 */
export function compareTotals(
  bc: Map<string, number>,
  telling: Map<string, number>
): CompareRow[] {
  const items = new Set<string>([...bc.keys(), ...telling.keys()])
  const out: CompareRow[] = []

  for (const item of items) {
    const bc_qty = bc.get(item) || 0
    const telling_qty = telling.get(item) || 0
    const diff = bc_qty - telling_qty

    let status: CompareRow['status']
    if (bc_qty === 0 && telling_qty > 0) status = 'enkel_telling'
    else if (telling_qty === 0 && bc_qty > 0) status = 'enkel_bc'
    else if (diff === 0) status = 'match'
    else if (diff > 0) status = 'te_versturen'
    else status = 'extra_in_stock'

    out.push({ item_number: item, bc_qty, telling_qty, diff, status })
  }

  out.sort((a, b) => {
    // sorteer eerst op categorie (meest relevante eerst), dan op itemnr
    const order: Record<CompareRow['status'], number> = {
      te_versturen: 0,
      enkel_bc: 1,
      extra_in_stock: 2,
      enkel_telling: 3,
      match: 4,
    }
    const ca = order[a.status]
    const cb = order[b.status]
    if (ca !== cb) return ca - cb
    return a.item_number.localeCompare(b.item_number)
  })

  return out
}

export interface CompareSummary {
  totalItems: number
  bcTotalQty: number
  tellingTotalQty: number
  match: number
  teVersturen: number
  extraInStock: number
  enkelBc: number
  enkelTelling: number
}

export function buildSummary(rows: CompareRow[]): CompareSummary {
  const s: CompareSummary = {
    totalItems: rows.length,
    bcTotalQty: 0,
    tellingTotalQty: 0,
    match: 0,
    teVersturen: 0,
    extraInStock: 0,
    enkelBc: 0,
    enkelTelling: 0,
  }
  for (const r of rows) {
    s.bcTotalQty += r.bc_qty
    s.tellingTotalQty += r.telling_qty
    if (r.status === 'match') s.match++
    else if (r.status === 'te_versturen') s.teVersturen++
    else if (r.status === 'extra_in_stock') s.extraInStock++
    else if (r.status === 'enkel_bc') s.enkelBc++
    else if (r.status === 'enkel_telling') s.enkelTelling++
  }
  return s
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export async function parseFirstSheet(file: File): Promise<unknown[][]> {
  const buf = await readFileAsArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const name = wb.SheetNames[0]
  if (!name) throw new Error('Geen werkblad gevonden in het bestand.')
  const sheet = wb.Sheets[name]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][]
}

/**
 * Voor de stock-telling file: probeer eerst het tab "Overzicht". Als dat niet
 * bestaat, val terug op de eerste tab.
 */
export async function parseTellingFile(file: File): Promise<unknown[][]> {
  const buf = await readFileAsArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const preferred = wb.SheetNames.find((n) => n.toLowerCase().includes('overzicht'))
  const name = preferred || wb.SheetNames[0]
  if (!name) throw new Error('Geen werkblad gevonden in het stock-telling bestand.')
  const sheet = wb.Sheets[name]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][]
}
