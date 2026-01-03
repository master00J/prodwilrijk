import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const division = formData.get('division') as string || 'AIF'
    const vendorCode = formData.get('vendorCode') as string || '77774'
    const deliveryDate = formData.get('deliveryDate') as string || new Date().toISOString().split('T')[0]

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    // Map Excel columns to XML fields
    // Expected columns: ItemNumber, Location, Quantity, PurchaseOrderNumber (optional)
    const xmlEntries: any[] = []

    for (const row of data as any[]) {
      // Try to find columns with various possible names
      const itemNumber = row['ItemNumber'] || row['Item Number'] || row['Item'] || row['Artikel'] || ''
      const location = row['Location'] || row['Locatie'] || row['Loc'] || ''
      const quantity = row['Quantity'] || row['Qty'] || row['Aantal'] || row['Amount'] || '1'
      const poNumber = row['PurchaseOrderNumber'] || row['PO Number'] || row['PO'] || row['Order'] || `MF-${Date.now()}`

      if (itemNumber && location) {
        xmlEntries.push({
          PurchaseOrderNumber: poNumber,
          Division: division,
          VendorCode: vendorCode,
          ItemNumber: String(itemNumber),
          Quantity: String(quantity),
          UnitOf: 'PCE',
          Location: String(location),
          PackingCode: 'PAC3PL',
          PackingInstruction: 'WILLEBROEK',
          DeliveryDate: deliveryDate,
          DueDate: deliveryDate,
          CreationDateTime: new Date().toISOString(),
          CompanyCode: 'APF',
          WarehouseCode: division,
        })
      }
    }

    if (xmlEntries.length === 0) {
      return NextResponse.json(
        { error: 'No valid data found in Excel file. Expected columns: ItemNumber, Location, Quantity' },
        { status: 400 }
      )
    }

    // Generate XML
    const xml = generateXML(xmlEntries)

    return NextResponse.json({
      success: true,
      xml,
      count: xmlEntries.length,
      filename: `${deliveryDate}_${division}.xml`,
    })
  } catch (error: any) {
    console.error('XML conversion error:', error)
    return NextResponse.json(
      { error: error.message || 'Error converting to XML' },
      { status: 500 }
    )
  }
}

function generateXML(entries: any[]): string {
  const xmlHeader = `<?xml version='1.0' encoding='utf-8'?>`
  const xmlStart = `<BE2NET_PO_INBOX xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
  const xmlEnd = `</BE2NET_PO_INBOX>`

  const entriesXML = entries.map(entry => {
    return `<BE2NET_PO_NEW>` +
      `<PurchaseOrderNumber>${escapeXML(entry.PurchaseOrderNumber)}</PurchaseOrderNumber>` +
      `<Division>${escapeXML(entry.Division)}</Division>` +
      `<VendorCode>${escapeXML(entry.VendorCode)}</VendorCode>` +
      `<ItemNumber>${escapeXML(entry.ItemNumber)}</ItemNumber>` +
      `<Quantity>${escapeXML(entry.Quantity)}</Quantity>` +
      `<UnitOf>${escapeXML(entry.UnitOf)}</UnitOf>` +
      `<Location>${escapeXML(entry.Location)}</Location>` +
      `<PackingCode>${escapeXML(entry.PackingCode)}</PackingCode>` +
      `<PackingInstruction>${escapeXML(entry.PackingInstruction)}</PackingInstruction>` +
      `<DeliveryDate>${escapeXML(entry.DeliveryDate)}</DeliveryDate>` +
      `<DueDate>${escapeXML(entry.DueDate)}</DueDate>` +
      `<CreationDateTime>${escapeXML(entry.CreationDateTime)}</CreationDateTime>` +
      `<CompanyCode>${escapeXML(entry.CompanyCode)}</CompanyCode>` +
      `<WarehouseCode>${escapeXML(entry.WarehouseCode)}</WarehouseCode>` +
      `</BE2NET_PO_NEW>`
  }).join('')

  return `${xmlHeader}${xmlStart}${entriesXML}${xmlEnd}`
}

function escapeXML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

