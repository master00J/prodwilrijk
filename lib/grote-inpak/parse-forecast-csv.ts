/**
 * Forecast CSV — drie Atlas-varianten:
 * - **FOR####** (FOR1953): `;`-gescheiden; kolom 0 datum (YYYYMMDD), 1 = Case Number, 2 = Case Type; vaak kopregel.
 * - **FORESCO.CSV** (standaard/specials): zelfde scheiding; kolom 0 datum; **label en type in kolom 5 en 6** (index 4–5), bv. `QB52F`, `V361`.
 * - **Bestandsnaam “standaard”**: zelfde kolommen als FORESCO (4–5).
 */
import { normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

/** UTF-16 BOM / UTF-8 BOM; anders Latin-1 (behoudt Atlas/OS-400 bytes zoals in IMAP). */
export function decodeForecastCsvBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString('utf16le').replace(/\0/g, '')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const body = Buffer.from(buf.subarray(2))
    if (body.length >= 2 && body.length % 2 === 0) {
      body.swap16()
      return body.toString('utf16le').replace(/\0/g, '')
    }
    return body.toString('latin1').replace(/\0/g, '')
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8').replace(/\0/g, '')
  }
  return buf.toString('latin1').replace(/\0/g, '')
}

function normalizeForecastCsvText(csvText: string): string {
  return String(csvText || '')
    .replace(/\0/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

/** Atlas FOR####-export: datum kolom 0, case label 1, case type 2 (puntkomma, kopregel). */
function isAtlasForCaseHeaderLine(line: string): boolean {
  const h = line.toLowerCase()
  return (
    h.includes('case number') &&
    h.includes('case type') &&
    (h.includes('sched') || h.includes('shg') || h.includes('item number'))
  )
}

export function parseForecastCSV(csvText: string, fileName: string): any[] {
  const normalized = normalizeForecastCsvText(csvText)
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const firstLine = lines[0]
  let delimiter = ','
  if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';'
  } else if (firstLine.includes('\t')) {
    delimiter = '\t'
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result.map((v) => v.replace(/^"|"$/g, '').trim())
  }

  const rows = lines.map(parseCSVLine)

  const fileBasename = (fileName || '').replace(/^.*[/\\]/, '').trim()
  const nameLower = fileBasename.toLowerCase()
  let stem = nameLower
  while (stem.endsWith('.csv')) stem = stem.slice(0, -4)
  const stemClean = stem.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
  /** FORESCO-atlas (incl. hernoemde varianten zoals FORESCOspecials): kolom 5–6 = label/type. */
  const isForescoCsvName = stemClean.startsWith('foresco')
  /** Atlas FOR-mails: FOR1953.CSV, maar ook afwijkende namen zoals _FOR1953.CSV_.CSV. */
  const isForDigitsFile =
    /^for\d+$/i.test(stemClean) || /\bfor\d{3,}\b/i.test(fileBasename)
  const isForescoStandaard = nameLower.includes('standaard')
  /** Nooit FOR-layout op FORESCO-bestanden (woord “foresco” bevat “for”). */
  const isAtlasForLayout =
    !isForescoCsvName && (isForDigitsFile || isAtlasForCaseHeaderLine(firstLine))

  const getCol = (row: string[], idx: number) => (idx < row.length ? row[idx] : '')
  const parseDate = (value: string): string | null => {
    const raw = String(value || '').trim()
    if (!/^\d{8}$/.test(raw)) return null
    const year = Number(raw.slice(0, 4))
    const month = Number(raw.slice(4, 6)) - 1
    const day = Number(raw.slice(6, 8))
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
  }

  const output: any[] = []
  rows.forEach((row) => {
    const dateRaw = getCol(row, 0)
    let caseLabel = ''
    let caseType = ''
    if (isAtlasForLayout && !isForescoStandaard) {
      caseLabel = getCol(row, 1)
      caseType = getCol(row, 2)
    } else {
      caseLabel = getCol(row, 4)
      caseType = getCol(row, 5)
    }

    const arrivalDate = parseDate(dateRaw)
    if (!caseLabel || !caseType || !arrivalDate) return
    const normalizedType = normalizeKistnummer(String(caseType || '').trim())

    output.push({
      case_label: String(caseLabel || '').trim(),
      case_type: normalizedType,
      arrival_date: arrivalDate,
      source_file: fileName || '',
    })
  })

  if (output.length === 0) return []

  const byLabel = new Map<string, any>()
  output.forEach((row) => {
    const key = String(row.case_label || '').trim()
    if (!key) return
    const existing = byLabel.get(key)
    if (!existing) {
      byLabel.set(key, row)
      return
    }
    const existingDate = new Date(existing.arrival_date)
    const newDate = new Date(row.arrival_date)
    if (!Number.isNaN(newDate.getTime()) && newDate > existingDate) {
      byLabel.set(key, row)
    }
  })

  return Array.from(byLabel.values())
}
