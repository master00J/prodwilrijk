/**
 * Forecast CSV (FORESCO / FOR#### / standaard-kolomindeling) — zelfde logica als handmatige upload.
 */
export function parseForecastCSV(csvText: string, fileName: string): any[] {
  const firstLine = csvText.split('\n')[0]
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

  const lines = csvText.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows = lines.map(parseCSVLine)
  const nameLower = (fileName || '').toLowerCase()
  const baseName = nameLower.replace(/\.csv$/i, '').replace(/^.*[/\\]/, '')
  /** Atlas-mails: FOR1953.CSV, FOR2044.CSV, … (niet FORESCO / standaard). */
  const isForDigitsFile = /^for\d+$/.test(baseName)
  const isForescoStandaard = nameLower.includes('standaard')

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
    if (isForDigitsFile) {
      caseLabel = getCol(row, 1)
      caseType = getCol(row, 2)
    } else if (isForescoStandaard) {
      caseLabel = getCol(row, 4)
      caseType = getCol(row, 5)
    } else {
      caseLabel = getCol(row, 4)
      caseType = getCol(row, 5)
    }

    const arrivalDate = parseDate(dateRaw)
    if (!caseLabel || !caseType || !arrivalDate) return
    const normalizedType = String(caseType || '').trim().replace(/^\s*[Vv]/, 'K')

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
