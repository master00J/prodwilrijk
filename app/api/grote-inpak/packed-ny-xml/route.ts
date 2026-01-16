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
    const packedNFiles = formData.getAll('packed_n').filter((item) => item instanceof File) as File[]
    const packedYFiles = formData.getAll('packed_y').filter((item) => item instanceof File) as File[]
    const purchaseOrder = String(formData.get('purchase_order') || '').trim()
    const itemSuffix = String(formData.get('item_suffix') || '').trim()

    if (packedNFiles.length === 0 && packedYFiles.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    const rows: PackedRow[] = []
    for (const file of packedNFiles) {
      rows.push(...parsePackedNyExcel(await file.arrayBuffer()))
    }
    for (const file of packedYFiles) {
      rows.push(...parsePackedNyExcel(await file.arrayBuffer()))
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
