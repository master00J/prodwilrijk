import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { validateExcelUpload } from '@/lib/api/upload-limits'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PackingGoodEntry = {
  atlasPalletNo: string
  currentPackageNo: string
  status: string
}

function cellValue(row: unknown[], index: number): string {
  if (index < 0) return ''
  const value = row[index]
  return String(value ?? '').trim()
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .trim()
}

function findHeaderIndex(headers: unknown[], names: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader)
  for (const name of names) {
    const normalizedName = normalizeHeader(name)
    const exact = normalizedHeaders.findIndex((header) => header === normalizedName)
    if (exact >= 0) return exact
  }
  for (const name of names) {
    const normalizedName = normalizeHeader(name)
    const loose = normalizedHeaders.findIndex(
      (header) =>
        header.includes(normalizedName) ||
        normalizedName.includes(header)
    )
    if (loose >= 0) return loose
  }
  return -1
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const current = next
      next += 1
      results[current] = await fn(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

function parsePackingGoodList(buffer: Buffer): PackingGoodEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes('packing good')) ||
    workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  const headers = rows[0] || []
  const statusIdx = findHeaderIndex(headers, ['Status'])
  const currentPackageIdx = findHeaderIndex(headers, [
    'Current Package No.',
    'Current Package No',
    'Package No.',
    'Package No',
    'Current Package',
  ])
  const atlasPalletIdx = findHeaderIndex(headers, [
    'Atlas Pallet No.',
    'Atlas Pallet No',
    'Alas Pallet No.',
    'Alas Pallet No',
    'Pallet No.',
    'Pallet No',
  ])

  if (currentPackageIdx < 0 || atlasPalletIdx < 0) {
    throw new Error('Kolommen "Current Package No." en/of "Atlas Pallet No." niet gevonden in de header.')
  }

  const entries: PackingGoodEntry[] = []

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || []
    const status = cellValue(row, statusIdx)
    const currentPackageNo = cellValue(row, currentPackageIdx)
    const atlasPalletNo = cellValue(row, atlasPalletIdx)

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

    const importedAt = new Date().toISOString()

    const updateResults = await mapWithConcurrency([...latestByPallet.values()], 15, async (entry) => {
      const update = {
        current_package_no: entry.currentPackageNo,
        packing_good_status: entry.status || null,
        packing_good_imported_at: importedAt,
      }

      const [openResult, packedResult] = await Promise.all([
        supabaseAdmin
          .from('items_to_pack')
          .update(update)
          .eq('po_number', entry.atlasPalletNo)
          .eq('packed', false)
          .select('id'),
        supabaseAdmin
          .from('packed_items')
          .update(update)
          .eq('po_number', entry.atlasPalletNo)
          .select('id'),
      ])

      if (openResult.error) {
        console.error('packing-good-list update:', openResult.error)
      }
      if (packedResult.error) {
        console.error('packing-good-list packed update:', packedResult.error)
      }

      const matched = openResult.data?.length || 0
      const packedMatched = packedResult.data?.length || 0

      return {
        matched,
        packedMatched,
        updated: matched + packedMatched,
      }
    })

    const matched = updateResults.reduce((sum, result) => sum + result.matched, 0)
    const packedMatched = updateResults.reduce((sum, result) => sum + result.packedMatched, 0)
    const updated = updateResults.reduce((sum, result) => sum + result.updated, 0)

    return NextResponse.json({
      success: true,
      parsed: entries.length,
      unique_pallets: latestByPallet.size,
      matched,
      packed_matched: packedMatched,
      updated,
    })
  } catch (error: any) {
    console.error('packing-good-list import error:', error)
    return NextResponse.json(
      { error: error.message || 'Packing Good List import mislukt' },
      { status: 500 }
    )
  }
})

