import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { supabaseAdmin } from '@/lib/supabase/server'
import { sanitizePostgrestOrValue } from '@/lib/api/postgrest-filter'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ItemToPackExportRow = {
  id: number
  item_number: string | null
  po_number: string | null
  amount: number | null
  date_added: string | null
  priority: boolean | null
  measurement: boolean | null
  packed: boolean | null
  problem: boolean | null
  problem_comment: string | null
  wms_line_id: string | null
  wms_import_date: string | null
  created_at: string | null
  updated_at: string | null
}

const pageSize = 1000
const thin = { style: 'thin' as const, color: { argb: 'FFD9E2EC' } }
const border = { top: thin, left: thin, bottom: thin, right: thin }

function applyFilters(query: any, request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = sanitizePostgrestOrValue(searchParams.get('search'))
  const dateFilter = searchParams.get('date') || ''
  const priorityOnly = searchParams.get('priority') === 'true'
  const measurementOnly = searchParams.get('measurement') === 'true'
  const problemOnly = searchParams.get('problem') === 'true'

  let filtered = query.eq('packed', false)

  if (search) {
    filtered = filtered.or(`item_number.ilike.%${search}%,po_number.ilike.%${search}%`)
  }

  if (dateFilter) {
    const filterDate = new Date(dateFilter)
    filterDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(filterDate)
    nextDay.setDate(nextDay.getDate() + 1)
    filtered = filtered.gte('date_added', filterDate.toISOString())
    filtered = filtered.lt('date_added', nextDay.toISOString())
  }

  if (priorityOnly) filtered = filtered.eq('priority', true)
  if (measurementOnly) filtered = filtered.eq('measurement', true)
  if (problemOnly) filtered = filtered.eq('problem', true)

  return filtered
}

async function fetchOpenItems(request: NextRequest): Promise<ItemToPackExportRow[]> {
  const rows: ItemToPackExportRow[] = []
  let from = 0

  while (true) {
    const baseQuery = supabaseAdmin
      .from('items_to_pack')
      .select(`
        id,
        item_number,
        po_number,
        amount,
        date_added,
        priority,
        measurement,
        packed,
        problem,
        problem_comment,
        wms_line_id,
        wms_import_date,
        created_at,
        updated_at
      `)

    const { data, error } = await applyFilters(baseQuery, request)
      .order('date_added', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return rows
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('nl-BE')
}

function boolLabel(value: boolean | null | undefined) {
  return value ? 'Ja' : 'Nee'
}

function buildWorkbook(rows: ItemToPackExportRow[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Prodwilrijk V2'
  wb.created = new Date()

  const ws = wb.addWorksheet('Open items to pack')
  ws.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Item nummer', key: 'item_number', width: 22 },
    { header: 'Pallet nummer', key: 'po_number', width: 22 },
    { header: 'Aantal open', key: 'amount', width: 14 },
    { header: 'Datum toegevoegd', key: 'date_added', width: 18 },
    { header: 'Prioriteit', key: 'priority', width: 12 },
    { header: 'Opmeting nodig', key: 'measurement', width: 16 },
    { header: 'Probleem', key: 'problem', width: 12 },
    { header: 'Probleem commentaar', key: 'problem_comment', width: 40 },
    { header: 'WMS lijn ID', key: 'wms_line_id', width: 22 },
    { header: 'WMS importdatum', key: 'wms_import_date', width: 18 },
    { header: 'Aangemaakt op', key: 'created_at', width: 18 },
    { header: 'Bijgewerkt op', key: 'updated_at', width: 18 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 22

  rows.forEach((row) => {
    ws.addRow({
      id: row.id,
      item_number: row.item_number || '',
      po_number: row.po_number || '',
      amount: Number(row.amount || 0),
      date_added: formatDate(row.date_added),
      priority: boolLabel(row.priority),
      measurement: boolLabel(row.measurement),
      problem: boolLabel(row.problem),
      problem_comment: row.problem_comment || '',
      wms_line_id: row.wms_line_id || '',
      wms_import_date: formatDate(row.wms_import_date),
      created_at: formatDate(row.created_at),
      updated_at: formatDate(row.updated_at),
    })
  })

  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = border
      cell.alignment = {
        vertical: 'middle',
        horizontal: rowNumber === 1 ? 'center' : 'left',
        wrapText: true,
      }
    })
  })

  ws.getColumn('amount').alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getColumn('priority').alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getColumn('measurement').alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getColumn('problem').alignment = { vertical: 'middle', horizontal: 'center' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  }

  return wb
}

export async function GET(request: NextRequest) {
  try {
    const rows = await fetchOpenItems(request)
    const wb = buildWorkbook(rows)
    const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
    const dateStr = new Date().toISOString().split('T')[0]

    return new Response(Buffer.from(buffer) as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="items-to-pack-openstaand-${dateStr}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('items-to-pack export error:', error)
    return NextResponse.json(
      { error: error.message || 'Excel export mislukt' },
      { status: 500 }
    )
  }
}
