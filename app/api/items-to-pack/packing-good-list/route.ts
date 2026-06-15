import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { validateExcelUpload } from '@/lib/api/upload-limits'
import { markItemsToPackShippedForPackageNos } from '@/lib/prepack/shipping-status'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PackingGoodEntry = {
  atlasPalletNo: string
  currentPackageNo: string
  status: string
}

function cellValue(row: unknown[], index: number): string {
  const value = row[index]
  return String(value ?? '').trim()
}

function parsePackingGoodList(buffer: Buffer): PackingGoodEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes('packing good')) ||
    workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  const entries: PackingGoodEntry[] = []

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || []
    const status = cellValue(row, 5) // F: Status
    const currentPackageNo = cellValue(row, 21) // V: Current Package No.
    const atlasPalletNo = cellValue(row, 29) // AD: Atlas Pallet No.

    if (!atlasPalletNo || !currentPackageNo) continue

    entries.push({
      atlasPalletNo,
      currentPackageNo,
      status,
    })
  }

  return entries
}

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }

    const uploadError = validateExcelUpload(file)
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const entries = parsePackingGoodList(buffer)

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Geen regels gevonden met Atlas Pallet No. en Current Package No.' },
        { status: 400 }
      )
    }

    const latestByPallet = new Map<string, PackingGoodEntry>()
    for (const entry of entries) {
      latestByPallet.set(entry.atlasPalletNo.toUpperCase(), entry)
    }

    let matched = 0
    let updated = 0
    let packedMatched = 0
    const packageNos: string[] = []
    const importedAt = new Date().toISOString()

    for (const entry of latestByPallet.values()) {
      const update = {
        current_package_no: entry.currentPackageNo,
        packing_good_status: entry.status || null,
        packing_good_imported_at: importedAt,
      }

      const { data, error } = await supabaseAdmin
        .from('items_to_pack')
        .update(update)
        .eq('po_number', entry.atlasPalletNo)
        .eq('packed', false)
        .select('id')

      if (error) {
        console.error('packing-good-list update:', error)
        continue
      }

      const count = data?.length || 0
      if (count > 0) {
        matched += count
        updated += count
        packageNos.push(entry.currentPackageNo)
      }

      const { data: packedData, error: packedError } = await supabaseAdmin
        .from('packed_items')
        .update(update)
        .eq('po_number', entry.atlasPalletNo)
        .select('id')

      if (packedError) {
        console.error('packing-good-list packed update:', packedError)
        continue
      }

      const packedCount = packedData?.length || 0
      if (packedCount > 0) {
        packedMatched += packedCount
        updated += packedCount
        packageNos.push(entry.currentPackageNo)
      }
    }

    const shipped = await markItemsToPackShippedForPackageNos(packageNos)

    return NextResponse.json({
      success: true,
      parsed: entries.length,
      unique_pallets: latestByPallet.size,
      matched,
      packed_matched: packedMatched,
      updated,
      shipped_updated: shipped.updated,
    })
  } catch (error: any) {
    console.error('packing-good-list import error:', error)
    return NextResponse.json(
      { error: error.message || 'Packing Good List import mislukt' },
      { status: 500 }
    )
  }
})

