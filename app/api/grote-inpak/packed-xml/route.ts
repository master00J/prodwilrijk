import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type PackedRow = {
  case_label: string
  series: string
  case_type: string
  packed_date: Date
}

const GROUP_VENDOR: Record<string, string> = {
  APF: '77774',
  S4: '77773',
  S5: '77775',
  S9: '77776',
}

function parsePackedExcel(buffer: ArrayBuffer): PackedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
  const result: PackedRow[] = []
  for (const row of rows) {
    const caseLabel = String(row[2] ?? '').trim()
    const series = String(row[4] ?? '').trim()
    const caseType = String(row[5] ?? '').trim()
    const dateRaw = String(row[9] ?? '').trim()
    const match = dateRaw.match(/(\d{6})/)
    if (!caseLabel || !caseType || !match) continue
    const date = parseYYMMDD(match[1])
    if (!date) continue
    result.push({
      case_label: caseLabel,
      series,
      case_type: caseType,
      packed_date: date,
    })
  }
  return result
}

function parseYYMMDD(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null
  const year = Number(`20${value.slice(0, 2)}`)
  const month = Number(value.slice(2, 4)) - 1
  const day = Number(value.slice(4, 6))
  const date = new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function shouldExcludeCaseType(caseType: string): boolean {
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

function buildXmlForGroup(rows: PackedRow[], group: string, poNumber: string): string {
  const now = new Date()
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}:${String(now.getSeconds()).padStart(2, '0')}.000`

  const parts: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
  ]

  rows.forEach((row) => {
    const locationLeft = row.series || ''
    const location = locationLeft ? `${locationLeft}/${row.case_label}` : `/${row.case_label}`
    const dateStr = formatDateXml(row.packed_date)
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const poApf = String(formData.get('po_apf') || '').trim()
    const poS4 = String(formData.get('po_s4') || '').trim()
    const poS5 = String(formData.get('po_s5') || '').trim()
    const poS9 = String(formData.get('po_s9') || '').trim()

    const buffer = await file.arrayBuffer()
    let rows = parsePackedExcel(buffer)
    if (rows.length === 0) {
      return NextResponse.json({ files: [] })
    }

    rows = rows.filter((row) => !shouldExcludeCaseType(row.case_type))
    if (rows.length === 0) {
      return NextResponse.json({ files: [] })
    }

    const groups = new Map<string, PackedRow[]>()
    rows.forEach((row) => {
      const grp = groupForSeries(row.series)
      const list = groups.get(grp) || []
      list.push(row)
      groups.set(grp, list)
    })

    const files: Array<{ filename: string; xml: string }> = []
    for (const [group, groupRows] of groups.entries()) {
      if (groupRows.length === 0) continue
      const minDate = new Date(Math.min(...groupRows.map((r) => r.packed_date.getTime())))
      const dateStr = formatDateForFilename(minDate)
      const suffix = group === 'APF' ? '' : ` ${group}`
      const filename = `${dateStr} Oilfree${suffix}.xml`
      const poNumber =
        (group === 'S4' ? poS4 : group === 'S5' ? poS5 : group === 'S9' ? poS9 : poApf) || poApf
      const xml = buildXmlForGroup(groupRows, group, poNumber)
      files.push({ filename, xml })
    }

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Packed XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Error generating packed XML' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type PackedRow = {
  case_label: string
  series: string
  case_type: string
  packed_date: Date
}

const GROUP_VENDOR: Record<string, string> = {
  APF: '77774',
  S4: '77773',
  S5: '77775',
  S9: '77776',
}

function parsePackedExcel(buffer: ArrayBuffer): PackedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
  const result: PackedRow[] = []
  for (const row of rows) {
    const caseLabel = String(row[2] ?? '').trim()
    const series = String(row[4] ?? '').trim()
    const caseType = String(row[5] ?? '').trim()
    const dateRaw = String(row[9] ?? '').trim()
    const match = dateRaw.match(/(\d{6})/)
    if (!caseLabel || !caseType || !match) continue
    const date = parseYYMMDD(match[1])
    if (!date) continue
    result.push({
      case_label: caseLabel,
      series,
      case_type: caseType,
      packed_date: date,
    })
  }
  return result
}

function parseYYMMDD(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null
  const year = Number(`20${value.slice(0, 2)}`)
  const month = Number(value.slice(2, 4)) - 1
  const day = Number(value.slice(4, 6))
  const date = new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function shouldExcludeCaseType(caseType: string): boolean {
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

function buildXmlForGroup(rows: PackedRow[], group: string, poNumber: string): string {
  const now = new Date()
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}:${String(now.getSeconds()).padStart(2, '0')}.000`

  const parts: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
  ]

  rows.forEach((row) => {
    const locationLeft = row.series || ''
    const location = locationLeft ? `${locationLeft}/${row.case_label}` : `/${row.case_label}`
    const dateStr = formatDateXml(row.packed_date)
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const poApf = String(formData.get('po_apf') || '').trim()
    const poS4 = String(formData.get('po_s4') || '').trim()
    const poS5 = String(formData.get('po_s5') || '').trim()
    const poS9 = String(formData.get('po_s9') || '').trim()

    const buffer = await file.arrayBuffer()
    let rows = parsePackedExcel(buffer)
    if (rows.length === 0) {
      return NextResponse.json({ files: [] })
    }

    rows = rows.filter((row) => !shouldExcludeCaseType(row.case_type))
    if (rows.length === 0) {
      return NextResponse.json({ files: [] })
    }

    const groups = new Map<string, PackedRow[]>()
    rows.forEach((row) => {
      const grp = groupForSeries(row.series)
      const list = groups.get(grp) || []
      list.push(row)
      groups.set(grp, list)
    })

    const files: Array<{ filename: string; xml: string }> = []
    for (const [group, groupRows] of groups.entries()) {
      if (groupRows.length === 0) continue
      const minDate = new Date(Math.min(...groupRows.map((r) => r.packed_date.getTime())))
      const dateStr = formatDateForFilename(minDate)
      const suffix = group === 'APF' ? '' : ` ${group}`
      const filename = `${dateStr} Oilfree${suffix}.xml`
      const poNumber =
        (group === 'S4' ? poS4 : group === 'S5' ? poS5 : group === 'S9' ? poS9 : poApf) || poApf
      const xml = buildXmlForGroup(groupRows, group, poNumber)
      files.push({ filename, xml })
    }

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Packed XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Error generating packed XML' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type PackedRow = {
  case_label: string
  series: string
  case_type: string
  packed_date: Date
}

const VENDOR_MAP: Record<string, string> = {
  APF: '77774',
  S4: '77773',
  S5: '77775',
  S9: '77776',
}

function parseYYMMDD(value: any): Date | null {
  const match = String(value || '').match(/(\d{6})/)
  if (!match) return null
  const raw = match[1]
  const yy = Number(raw.slice(0, 2))
  const mm = Number(raw.slice(2, 4))
  const dd = Number(raw.slice(4, 6))
  if (!yy || !mm || !dd) return null
  const year = yy < 70 ? 2000 + yy : 1900 + yy
  const date = new Date(Date.UTC(year, mm - 1, dd))
  return Number.isNaN(date.getTime()) ? null : date
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatCreationDateTime(date: Date): string {
  const iso = date.toISOString()
  return `${iso.split('.')[0]}.000`
}

function groupForSeries(series: string): string {
  const s = (series || '').trim().toUpperCase()
  if (s.startsWith('S4')) return 'S4'
  if (s.startsWith('S5')) return 'S5'
  if (s.startsWith('S9')) return 'S9'
  return 'APF'
}

function shouldExclude(caseType: string): boolean {
  const trimmed = String(caseType || '').trim()
  if (!trimmed) return true
  const prefix = trimmed[0]?.toUpperCase()
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

function parsePackedRows(buffer: Buffer): PackedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][]

  const output: PackedRow[] = []
  rows.forEach((row, index) => {
    if (index === 0) return
    const caseLabel = String(row?.[2] || '').trim()
    const series = String(row?.[4] || '').trim()
    const caseType = String(row?.[5] || '').trim()
    const dateValue = row?.[9]
    const packedDate = parseYYMMDD(dateValue)

    if (!caseLabel || !caseType || !packedDate) return
    output.push({ case_label: caseLabel, series, case_type: caseType, packed_date: packedDate })
  })
  return output
}

function buildXml(rows: PackedRow[], po: string, group: string): string {
  const now = new Date()
  const root = rows
    .map((row) => {
      const location = row.series ? `${row.series}/${row.case_label}` : `/${row.case_label}`
      const dateStr = formatDate(row.packed_date)
      return (
        `<BE2NET_PO_NEW>` +
        `<PurchaseOrderNumber>${escapeXml(po)}</PurchaseOrderNumber>` +
        `<Division>AIF</Division>` +
        `<VendorCode>${VENDOR_MAP[group] || VENDOR_MAP.APF}</VendorCode>` +
        `<ItemNumber>${escapeXml(row.case_type)}</ItemNumber>` +
        `<Quantity>1</Quantity>` +
        `<UnitOf>PCE</UnitOf>` +
        `<Location>${escapeXml(location)}</Location>` +
        `<PackingCode>PAC3PL</PackingCode>` +
        `<PackingInstruction>WILLEBROEK</PackingInstruction>` +
        `<DeliveryDate>${dateStr}</DeliveryDate>` +
        `<DueDate>${dateStr}</DueDate>` +
        `<CreationDateTime>${formatCreationDateTime(now)}</CreationDateTime>` +
        `<CompanyCode>APF</CompanyCode>` +
        `<WarehouseCode>AIF</WarehouseCode>` +
        `</BE2NET_PO_NEW>`
      )
    })
    .join('')

  return `<?xml version='1.0' encoding='utf-8'?><BE2NET_PO_INBOX xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">${root}</BE2NET_PO_INBOX>`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const poApf = String(formData.get('po_apf') || '').trim()
    const poS4 = String(formData.get('po_s4') || '').trim()
    const poS5 = String(formData.get('po_s5') || '').trim()
    const poS9 = String(formData.get('po_s9') || '').trim()

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parsePackedRows(buffer).filter((row) => !shouldExclude(row.case_type))
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Geen geldige packed rijen gevonden.' }, { status: 400 })
    }

    const grouped: Record<string, PackedRow[]> = {}
    rows.forEach((row) => {
      const group = groupForSeries(row.series)
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(row)
    })

    const files = Object.entries(grouped).map(([group, groupRows]) => {
      const minDate = groupRows.reduce((acc, row) => (row.packed_date < acc ? row.packed_date : acc), groupRows[0].packed_date)
      const dateLabel = `${String(minDate.getUTCDate()).padStart(2, '0')}-${String(minDate.getUTCMonth() + 1).padStart(2, '0')}`
      const po = group === 'S4' ? poS4 : group === 'S5' ? poS5 : group === 'S9' ? poS9 : poApf
      const suffix = group === 'APF' ? '' : ` ${group}`
      return {
        group,
        filename: `${dateLabel} Oilfree${suffix}.xml`,
        xml: buildXml(groupRows, po, group),
      }
    })

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Packed XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Packed XML export error' },
      { status: 500 }
    )
  }
}
