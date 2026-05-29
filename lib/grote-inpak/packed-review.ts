import * as XLSX from 'xlsx'
import { expandWorksheetRef } from '@/lib/xlsx/expand-worksheet-ref'

export type PackedSourceType = 'packed' | 'packed_n' | 'packed_y'

export interface PackedReviewRow {
  id?: number
  batch_id?: number
  row_index?: number
  source_type: PackedSourceType
  case_label: string
  series: string
  case_type: string
  packed_date: string
  excluded?: boolean
  notes?: string | null
}

export interface XmlFile {
  filename: string
  xml: string
}

/** Regel meenemen in XML-export (Gebruik uitgevinkt → excluded). */
export function isRowIncludedInExport(row: PackedReviewRow): boolean {
  return row.excluded !== true
}

export function batchHasIndusRows(rows: PackedReviewRow[]): boolean {
  return rows.some(row => row.source_type === 'packed_n' || row.source_type === 'packed_y')
}

export function batchHasOilfreeRows(rows: PackedReviewRow[]): boolean {
  return rows.some(row => row.source_type === 'packed')
}

const GROUP_VENDOR: Record<string, string> = {
  APF: '77774',
  S4: '77773',
  S5: '77775',
  S9: '77776',
}

export function getPackedSourceType(filename: string): PackedSourceType | null {
  const name = filename.toLowerCase()
  if (!/\.(xlsx|xls)$/i.test(filename)) return null
  if (/packed[\s_-]?n/.test(name)) return 'packed_n'
  if (/packed[\s_-]?y/.test(name)) return 'packed_y'
  if (/packed/.test(name)) return 'packed'
  return null
}

/** Bepaal type bij import: gecombineerde mailbox-bestanden zonder _N/_Y → INDUS (packed_n). */
export function resolvePackedSourceTypeForImport(
  filename: string,
  buffer: Buffer | ArrayBuffer
): PackedSourceType | null {
  const fromName = getPackedSourceType(filename)
  if (!fromName) return null
  if (fromName === 'packed_n' || fromName === 'packed_y') return fromName

  const oilfreeCount = parsePackedReviewRows(buffer, 'packed').length
  const nyCount = parsePackedReviewRows(buffer, 'packed_n').length
  if (nyCount > 0 && nyCount >= oilfreeCount) return 'packed_n'
  return fromName
}

export function parsePackedReviewRows(buffer: Buffer | ArrayBuffer, sourceType: PackedSourceType): PackedReviewRow[] {
  const wb = XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []

  expandWorksheetRef(ws)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
  const result: PackedReviewRow[] = []

  rows.forEach((row, index) => {
    const parsed = sourceType === 'packed'
      ? parsePackedRow(row, sourceType)
      : parsePackedNyRow(row, sourceType)
    if (parsed) {
      result.push({
        ...parsed,
        row_index: index,
      })
    }
  })

  return result
}

function parsePackedRow(row: any[], sourceType: PackedSourceType): PackedReviewRow | null {
  const caseLabel = String(row[2] ?? '').trim()
  const series = String(row[4] ?? '').trim()
  const caseType = String(row[5] ?? '').trim()
  const dateRaw = String(row[9] ?? '').trim()
  const match = dateRaw.match(/(\d{6})/)
  if (!caseLabel || !caseType || !match) return null

  const packedDate = parseYYMMDD(match[1])
  if (!packedDate) return null

  return {
    source_type: sourceType,
    case_label: caseLabel,
    series,
    case_type: caseType,
    packed_date: packedDate,
  }
}

function parsePackedNyRow(row: any[], sourceType: PackedSourceType): PackedReviewRow | null {
  const series = String(row[1] ?? '').trim()
  const caseLabel = String(row[2] ?? '').trim()
  const caseType = String(row[3] ?? '').trim()
  const dateRaw = String(row[7] ?? '').trim()
  const match = dateRaw.match(/(\d{6})/)
  if (!caseLabel || !caseType || !match) return null

  const packedDate = parseYYMMDD(match[1])
  if (!packedDate) return null

  return {
    source_type: sourceType,
    case_label: caseLabel,
    series,
    case_type: caseType,
    packed_date: packedDate,
  }
}

function parseYYMMDD(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null
  const year = Number(`20${value.slice(0, 2)}`)
  const month = Number(value.slice(2, 4))
  const day = Number(value.slice(4, 6))
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shouldExcludeOilfreeCaseType(caseType: string): boolean {
  const trimmed = String(caseType || '').trim()
  if (!trimmed) return true
  const prefix = trimmed[0].toUpperCase()
  if (prefix === 'C') return true
  if (prefix === 'V' || prefix === 'K') {
    const match = trimmed.match(/(\d+)/)
    if (match) {
      const num = Number(match[1])
      if (!Number.isNaN(num)) {
        return num >= 11 && num <= 99
      }
    }
  }
  return false
}

function groupForSeries(series: string): string {
  const s = String(series || '').trim().toUpperCase()
  if (s.startsWith('S4')) return 'S4'
  if (s.startsWith('S5')) return 'S5'
  if (s.startsWith('S9')) return 'S9'
  return 'APF'
}

function formatDateForFilename(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}`
}

function formatDateXml(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function xmlEscape(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createdAtXml(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}:${String(now.getSeconds()).padStart(2, '0')}.000`
}

export function buildOilfreeXmlFiles(
  rows: PackedReviewRow[],
  poNumbers: { apf: string; s4: string; s5: string; s9: string }
): XmlFile[] {
  const included = rows
    .filter(isRowIncludedInExport)
    .filter(row => row.source_type === 'packed')
    .filter(row => !shouldExcludeOilfreeCaseType(row.case_type))

  const groups = new Map<string, PackedReviewRow[]>()
  included.forEach((row) => {
    const group = groupForSeries(row.series)
    groups.set(group, [...(groups.get(group) || []), row])
  })

  const files: XmlFile[] = []
  for (const [group, groupRows] of groups.entries()) {
    const minDate = new Date(Math.min(...groupRows.map(row => toDate(row.packed_date).getTime())))
    const dateStr = formatDateForFilename(minDate)
    const suffix = group === 'APF' ? '' : ` ${group}`
    const filename = `${dateStr} Oilfree${suffix}.xml`
    const poNumber =
      (group === 'S4' ? poNumbers.s4 : group === 'S5' ? poNumbers.s5 : group === 'S9' ? poNumbers.s9 : poNumbers.apf) ||
      poNumbers.apf

    files.push({
      filename,
      xml: buildOilfreeXml(groupRows, group, poNumber),
    })
  }

  return files
}

function buildOilfreeXml(rows: PackedReviewRow[], group: string, poNumber: string): string {
  const createdAt = createdAtXml()
  const parts: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
  ]

  rows.forEach((row) => {
    const location = row.series ? `${row.series}/${row.case_label}` : `/${row.case_label}`
    const dateStr = formatDateXml(toDate(row.packed_date))
    parts.push(
      `<BE2NET_PO_NEW>` +
        `<PurchaseOrderNumber>${xmlEscape(poNumber)}</PurchaseOrderNumber>` +
        `<Division>AIF</Division>` +
        `<VendorCode>${xmlEscape(GROUP_VENDOR[group] || GROUP_VENDOR.APF)}</VendorCode>` +
        `<ItemNumber>${xmlEscape(row.case_type)}</ItemNumber>` +
        `<Quantity>1</Quantity>` +
        `<UnitOf>PCE</UnitOf>` +
        `<Location>${xmlEscape(location)}</Location>` +
        `<PackingCode>PAC3PL</PackingCode>` +
        `<PackingInstruction>WILLEBROEK</PackingInstruction>` +
        `<DeliveryDate>${dateStr}</DeliveryDate>` +
        `<DueDate>${dateStr}</DueDate>` +
        `<CreationDateTime>${createdAt}</CreationDateTime>` +
        `<CompanyCode>APF</CompanyCode>` +
        `<WarehouseCode>AIF</WarehouseCode>` +
      `</BE2NET_PO_NEW>`
    )
  })

  parts.push(`</BE2NET_PO_INBOX>`)
  return parts.join('')
}

export function buildIndusXmlFile(
  rows: PackedReviewRow[],
  purchaseOrder: string,
  itemSuffix = ''
): XmlFile | null {
  // N en Y in één indus.xml (zelfde klant/PO); Y-regels krijgen optioneel suffix op itemnummer.
  const included = rows
    .filter(isRowIncludedInExport)
    .filter(row => row.source_type === 'packed_n' || row.source_type === 'packed_y')
    .filter(row => {
      const caseType = row.case_type.trim().toUpperCase()
      return caseType && !caseType.startsWith('C999')
    })

  if (included.length === 0) return null

  const minDate = new Date(Math.min(...included.map(row => toDate(row.packed_date).getTime())))
  const dateStr = formatDateForFilename(minDate)
  const createdAt = createdAtXml()
  const parts: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
  ]

  included.forEach((row) => {
    let itemNumber = row.case_type
    const suffixForRow = row.source_type === 'packed_y' ? itemSuffix : ''
    if (suffixForRow && !itemNumber.toUpperCase().endsWith(suffixForRow.toUpperCase())) {
      itemNumber = `${itemNumber}${suffixForRow}`
    }
    const dateStrXml = formatDateXml(toDate(row.packed_date))
    parts.push(
      `<BE2NET_PO_NEW>` +
        `<PurchaseOrderNumber>${xmlEscape(purchaseOrder)}</PurchaseOrderNumber>` +
        `<Division>AII</Division>` +
        `<VendorCode>77777</VendorCode>` +
        `<ItemNumber>${xmlEscape(itemNumber)}</ItemNumber>` +
        `<Quantity>1</Quantity>` +
        `<UnitOf>PCE</UnitOf>` +
        `<Location>${xmlEscape(`${row.series || ''}/${row.case_label || ''}`)}</Location>` +
        `<PackingCode>PAC3PL</PackingCode>` +
        `<PackingInstruction>WILLEBROEK</PackingInstruction>` +
        `<DeliveryDate>${dateStrXml}</DeliveryDate>` +
        `<DueDate>${dateStrXml}</DueDate>` +
        `<CreationDateTime>${createdAt}</CreationDateTime>` +
        `<CompanyCode>API</CompanyCode>` +
        `<WarehouseCode>AII</WarehouseCode>` +
      `</BE2NET_PO_NEW>`
    )
  })

  parts.push(`</BE2NET_PO_INBOX>`)
  return {
    filename: `${dateStr} indus.xml`,
    xml: parts.join(''),
  }
}
