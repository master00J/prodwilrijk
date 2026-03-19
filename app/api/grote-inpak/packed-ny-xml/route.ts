import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type PackedRow = {
  case_label: string
  series: string
  case_type: string
  packed_date: Date
}

function parseYYMMDD(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null
  const year = Number(`20${value.slice(0, 2)}`)
  const month = Number(value.slice(2, 4)) - 1
  const day = Number(value.slice(4, 6))
  const date = new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function parsePackedNyExcel(buffer: ArrayBuffer): PackedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
  const result: PackedRow[] = []
  for (const row of rows) {
    const series = String(row[1] ?? '').trim()
    const caseLabel = String(row[2] ?? '').trim()
    const caseType = String(row[3] ?? '').trim()
    const dateRaw = String(row[7] ?? '').trim()
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const packedN = formData.get('packed_n') as File | null
    const packedY = formData.get('packed_y') as File | null
    const purchaseOrder = String(formData.get('purchase_order') || '').trim()
    const itemSuffix = String(formData.get('item_suffix') || '').trim()

    if (!packedN && !packedY) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    const rows: PackedRow[] = []
    if (packedN) {
      rows.push(...parsePackedNyExcel(await packedN.arrayBuffer()))
    }
    if (packedY) {
      rows.push(...parsePackedNyExcel(await packedY.arrayBuffer()))
    }

    const filtered = rows.filter((row) => {
      const ct = String(row.case_type || '').trim().toUpperCase()
      return ct && !ct.startsWith('C999')
    })

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Geen data gevonden' }, { status: 400 })
    }

    const minDate = new Date(Math.min(...filtered.map((r) => r.packed_date.getTime())))
    const dateStr = formatDateForFilename(minDate)
    const filename = `${dateStr} indus.xml`

    const now = new Date()
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.000`

    const parts: string[] = [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    ]

    filtered.forEach((row) => {
      let itemNumber = String(row.case_type || '')
      if (itemSuffix && !itemNumber.toUpperCase().endsWith(itemSuffix.toUpperCase())) {
        itemNumber = `${itemNumber}${itemSuffix}`
      }
      const location = `${row.series || ''}/${row.case_label || ''}`
      const dateStrXml = formatDateXml(row.packed_date)
      parts.push(
        `<BE2NET_PO_NEW>` +
          `<PurchaseOrderNumber>${xmlEscape(purchaseOrder)}</PurchaseOrderNumber>` +
          `<Division>AII</Division>` +
          `<VendorCode>77777</VendorCode>` +
          `<ItemNumber>${xmlEscape(itemNumber)}</ItemNumber>` +
          `<Quantity>1</Quantity>` +
          `<UnitOf>PCE</UnitOf>` +
          `<Location>${xmlEscape(location)}</Location>` +
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
    const xml = parts.join('')

    return NextResponse.json({ filename, xml })
  } catch (error: any) {
    console.error('INDUS XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Error generating INDUS XML' },
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

function parseYYMMDD(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null
  const year = Number(`20${value.slice(0, 2)}`)
  const month = Number(value.slice(2, 4)) - 1
  const day = Number(value.slice(4, 6))
  const date = new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function parsePackedNyExcel(buffer: ArrayBuffer): PackedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
  const result: PackedRow[] = []
  for (const row of rows) {
    const series = String(row[1] ?? '').trim()
    const caseLabel = String(row[2] ?? '').trim()
    const caseType = String(row[3] ?? '').trim()
    const dateRaw = String(row[7] ?? '').trim()
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const packedN = formData.get('packed_n') as File | null
    const packedY = formData.get('packed_y') as File | null
    const purchaseOrder = String(formData.get('purchase_order') || '').trim()
    const itemSuffix = String(formData.get('item_suffix') || '').trim()

    if (!packedN && !packedY) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    const rows: PackedRow[] = []
    if (packedN) {
      rows.push(...parsePackedNyExcel(await packedN.arrayBuffer()))
    }
    if (packedY) {
      rows.push(...parsePackedNyExcel(await packedY.arrayBuffer()))
    }

    const filtered = rows.filter((row) => {
      const ct = String(row.case_type || '').trim().toUpperCase()
      return ct && !ct.startsWith('C999')
    })

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Geen data gevonden' }, { status: 400 })
    }

    const minDate = new Date(Math.min(...filtered.map((r) => r.packed_date.getTime())))
    const dateStr = formatDateForFilename(minDate)
    const filename = `${dateStr} indus.xml`

    const now = new Date()
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.000`

    const parts: string[] = [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    ]

    filtered.forEach((row) => {
      let itemNumber = String(row.case_type || '')
      if (itemSuffix && !itemNumber.toUpperCase().endsWith(itemSuffix.toUpperCase())) {
        itemNumber = `${itemNumber}${itemSuffix}`
      }
      const location = `${row.series || ''}/${row.case_label || ''}`
      const dateStrXml = formatDateXml(row.packed_date)
      parts.push(
        `<BE2NET_PO_NEW>` +
          `<PurchaseOrderNumber>${xmlEscape(purchaseOrder)}</PurchaseOrderNumber>` +
          `<Division>AII</Division>` +
          `<VendorCode>77777</VendorCode>` +
          `<ItemNumber>${xmlEscape(itemNumber)}</ItemNumber>` +
          `<Quantity>1</Quantity>` +
          `<UnitOf>PCE</UnitOf>` +
          `<Location>${xmlEscape(location)}</Location>` +
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
    const xml = parts.join('')

    return NextResponse.json({ filename, xml })
  } catch (error: any) {
    console.error('INDUS XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Error generating INDUS XML' },
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

function parsePackedNy(buffer: Buffer): PackedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][]
  const output: PackedRow[] = []
  rows.forEach((row, index) => {
    if (index === 0) return
    const series = String(row?.[1] || '').trim()
    const caseLabel = String(row?.[2] || '').trim()
    const caseType = String(row?.[3] || '').trim()
    const dateValue = row?.[7]
    const packedDate = parseYYMMDD(dateValue)
    if (!caseLabel || !caseType || !packedDate) return
    output.push({ series, case_label: caseLabel, case_type: caseType, packed_date: packedDate })
  })
  return output
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileN = formData.get('packed_n') as File | null
    const fileY = formData.get('packed_y') as File | null
    const purchaseOrder = String(formData.get('purchase_order') || '').trim()
    const itemSuffix = String(formData.get('item_suffix') || '').trim()

    if (!fileN && !fileY) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const rows: PackedRow[] = []
    if (fileN) {
      const buffer = Buffer.from(await fileN.arrayBuffer())
      rows.push(...parsePackedNy(buffer))
    }
    if (fileY) {
      const buffer = Buffer.from(await fileY.arrayBuffer())
      rows.push(...parsePackedNy(buffer))
    }

    const filtered = rows.filter(
      (row) => !String(row.case_type || '').trim().toUpperCase().startsWith('C999')
    )

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Geen geldige PACKED_N/Y rijen gevonden.' }, { status: 400 })
    }

    const minDate = filtered.reduce((acc, row) => (row.packed_date < acc ? row.packed_date : acc), filtered[0].packed_date)
    const dateLabel = `${String(minDate.getUTCDate()).padStart(2, '0')}-${String(minDate.getUTCMonth() + 1).padStart(2, '0')}`
    const now = new Date()

    const entries = filtered
      .map((row) => {
        let itemNumber = row.case_type
        if (itemSuffix && !itemNumber.toUpperCase().endsWith(itemSuffix.toUpperCase())) {
          itemNumber = `${itemNumber}${itemSuffix}`
        }
        const location = `${row.series}/${row.case_label}`
        const dateStr = formatDate(row.packed_date)
        return (
          `<BE2NET_PO_NEW>` +
          `<PurchaseOrderNumber>${escapeXml(purchaseOrder)}</PurchaseOrderNumber>` +
          `<Division>AII</Division>` +
          `<VendorCode>77777</VendorCode>` +
          `<ItemNumber>${escapeXml(itemNumber)}</ItemNumber>` +
          `<Quantity>1</Quantity>` +
          `<UnitOf>PCE</UnitOf>` +
          `<Location>${escapeXml(location)}</Location>` +
          `<PackingCode>PAC3PL</PackingCode>` +
          `<PackingInstruction>WILLEBROEK</PackingInstruction>` +
          `<DeliveryDate>${dateStr}</DeliveryDate>` +
          `<DueDate>${dateStr}</DueDate>` +
          `<CreationDateTime>${formatCreationDateTime(now)}</CreationDateTime>` +
          `<CompanyCode>API</CompanyCode>` +
          `<WarehouseCode>AII</WarehouseCode>` +
          `</BE2NET_PO_NEW>`
        )
      })
      .join('')

    const xml = `<?xml version='1.0' encoding='utf-8'?><BE2NET_PO_INBOX xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">${entries}</BE2NET_PO_INBOX>`

    return NextResponse.json({
      xml,
      filename: `${dateLabel} indus.xml`,
    })
  } catch (error: any) {
    console.error('INDUS XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'INDUS XML export error' },
      { status: 500 }
    )
  }
}
