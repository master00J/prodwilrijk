import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const normalize = (value: any) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const isEmptyRow = (row: any[]) =>
  row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value).replace(',', '.').replace(/[^\d.-]/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDateValue = (value: any): string | null => {
  if (!value) return null
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const yyyy = String(parsed.y).padStart(4, '0')
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
  }
  const dateStr = String(value).trim()
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? match[0] : null
}

const findValueByLabel = (rows: any[][], labels: string[]) => {
  const labelSet = labels.map((label) => normalize(label))
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i]
      if (!cell) continue
      const cellNorm = normalize(cell)
      if (labelSet.some((label) => cellNorm === label || cellNorm.includes(label))) {
        for (let j = i + 1; j < row.length; j++) {
          const value = row[j]
          if (value !== null && value !== undefined && String(value).trim() !== '') {
            return value
          }
        }
      }
    }
  }
  return null
}

const extractGeneralInfo = (rows: any[][]) => {
  const get = (labels: string[]) => findValueByLabel(rows, labels)
  const date = parseDateValue(get(['date']))

  const sectionIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === normalize('Machine measuring in production'))
  )
  const sectionRows = sectionIndex >= 0 ? rows.slice(sectionIndex + 1, sectionIndex + 10) : rows
  const getSection = (labels: string[]) => findValueByLabel(sectionRows, labels)

  return {
    date,
    project_no: String(get(['project no.', 'project no']) || '').trim(),
    machine_type: String(get(['machine type']) || '').trim() || null,
    modality: String(get(['modality']) || '').trim() || null,
    production_location: String(get(['production location']) || '').trim() || null,
    packing_company: String(get(['packing company']) || '').trim() || null,
    packing_company_reference: String(get(['packing company reference no', 'packing company reference no.']) || '').trim() || null,
    transport_week_contract: String(get(['transport week contract']) || '').trim() || null,
    vmi_ref_no: String(get(['vmi ref.no.', 'vmi ref no', 'vmi ref.no']) || '').trim() || null,
    vmi_employee: String(get(['vmi employee']) || '').trim() || null,
    measuring_location: String(getSection(['location']) || '').trim() || null,
    measuring_date_requested: parseDateValue(getSection(['date requested'])),
    measuring_contact_person: String(getSection(['contact person production']) || '').trim() || null,
    measuring_team: String(getSection(['team']) || '').trim() || null,
    measuring_hall: String(getSection(['hall']) || '').trim() || null,
  }
}

const headerAliases: Record<string, string[]> = {
  truck_or_container: ['truck / container no', 'truck / container', 'truck / container no.'],
  outer_pack_no: ['outer pack no', 'outer packing no', 'outer packing no.'],
  packing_no: ['packing no', 'packing no.'],
  label_item_no: ['label item no', 'label item no.'],
  article_no: ['article no', 'article no.'],
  description: ['description type outer packing + material', 'description machine parts', 'description'],
  qty: ['qty'],
  part_of: ['part of'],
  length_cm: ['length (cm)'],
  width_cm: ['width (cm)'],
  height_cm: ['height (cm)'],
  length_mm: ['length (mm)'],
  width_mm: ['width (mm)'],
  height_mm: ['height (mm)'],
  weight_netto_kg: ['weight netto (kg)', 'weight indication netto (kg)'],
  weight_gross_kg: ['weight gross (kg)'],
  weight_measured_kg: ['weight measured netto (kg)'],
  label_qty: ['label qty'],
}

const getHeaderIndexMap = (row: any[]) => {
  const map: Record<string, number> = {}
  row.forEach((cell, idx) => {
    const cellNorm = normalize(cell)
    for (const [key, aliases] of Object.entries(headerAliases)) {
      if (aliases.some((alias) => cellNorm === normalize(alias))) {
        map[key] = idx
      }
    }
  })
  return map
}

const isHeaderRow = (row: any[]) => {
  const map = getHeaderIndexMap(row)
  return Object.keys(map).length >= 5
}

const parseLinesFromSheet = (rows: any[][], sourceSheet: string) => {
  const lines: any[] = []
  let i = 0
  let sortOrder = 1

  while (i < rows.length) {
    const row = rows[i]
    if (!row || row.length === 0) {
      i += 1
      continue
    }

    if (isHeaderRow(row)) {
      const headerMap = getHeaderIndexMap(row)
      const descriptionHeader = normalize(row[headerMap.description])
      const lineType = descriptionHeader.includes('outer packing') ? 'outer_packing' : 'machine_part'

      i += 1
      while (i < rows.length && !isHeaderRow(rows[i])) {
        const dataRow = rows[i]
        if (!dataRow || isEmptyRow(dataRow)) {
          i += 1
          continue
        }

        const description = headerMap.description !== undefined ? dataRow[headerMap.description] : null
        const articleNo = headerMap.article_no !== undefined ? dataRow[headerMap.article_no] : null
        const packingNo = headerMap.packing_no !== undefined ? dataRow[headerMap.packing_no] : null
        const qty = headerMap.qty !== undefined ? dataRow[headerMap.qty] : null

        if (!description && !articleNo && !qty) {
          i += 1
          continue
        }

        lines.push({
          line_type: lineType,
          source_sheet: sourceSheet,
          sort_order: sortOrder++,
          truck_or_container: headerMap.truck_or_container !== undefined ? String(dataRow[headerMap.truck_or_container] || '').trim() || null : null,
          outer_pack_no: headerMap.outer_pack_no !== undefined ? String(dataRow[headerMap.outer_pack_no] || '').trim() || null : null,
          packing_no: packingNo ? String(packingNo).trim() : null,
          label_item_no: headerMap.label_item_no !== undefined ? String(dataRow[headerMap.label_item_no] || '').trim() || null : null,
          article_no: articleNo
            ? String(articleNo).trim()
            : packingNo
            ? String(packingNo).trim()
            : null,
          description: description ? String(description).trim() : null,
          qty: parseNumber(qty),
          part_of: headerMap.part_of !== undefined ? String(dataRow[headerMap.part_of] || '').trim() || null : null,
          length_mm: parseNumber(headerMap.length_mm !== undefined ? dataRow[headerMap.length_mm] : null),
          width_mm: parseNumber(headerMap.width_mm !== undefined ? dataRow[headerMap.width_mm] : null),
          height_mm: parseNumber(headerMap.height_mm !== undefined ? dataRow[headerMap.height_mm] : null),
          length_cm: parseNumber(headerMap.length_cm !== undefined ? dataRow[headerMap.length_cm] : null),
          width_cm: parseNumber(headerMap.width_cm !== undefined ? dataRow[headerMap.width_cm] : null),
          height_cm: parseNumber(headerMap.height_cm !== undefined ? dataRow[headerMap.height_cm] : null),
          weight_netto_kg: parseNumber(headerMap.weight_netto_kg !== undefined ? dataRow[headerMap.weight_netto_kg] : null),
          weight_gross_kg: parseNumber(headerMap.weight_gross_kg !== undefined ? dataRow[headerMap.weight_gross_kg] : null),
          weight_measured_kg: parseNumber(headerMap.weight_measured_kg !== undefined ? dataRow[headerMap.weight_measured_kg] : null),
          label_qty: parseNumber(headerMap.label_qty !== undefined ? dataRow[headerMap.label_qty] : null),
          status: 'open',
        })

        i += 1
      }
      continue
    }

    i += 1
  }

  return lines
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: 'No sheets found in the file' }, { status: 400 })
    }

    const generalSheetName =
      workbook.SheetNames.find((name) => normalize(name).includes('gen measuring')) ||
      workbook.SheetNames.find((name) => normalize(name).includes('gen measuring production')) ||
      workbook.SheetNames[0]

    const generalSheet = workbook.Sheets[generalSheetName]
    const generalRows = XLSX.utils.sheet_to_json(generalSheet, { header: 1, raw: true }) as any[][]
    const generalInfo = extractGeneralInfo(generalRows)

    if (!generalInfo.project_no) {
      return NextResponse.json({ error: 'Projectnummer ontbreekt in het bestand' }, { status: 400 })
    }

    const lines: any[] = []
    workbook.SheetNames.forEach((sheetName) => {
      const normalizedName = normalize(sheetName)
      if (
        normalizedName.includes('receiving and packing') ||
        normalizedName.includes('packing information')
      ) {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][]
        lines.push(...parseLinesFromSheet(rows, sheetName))
      }
    })

    const { data: projectData, error: projectError } = await supabaseAdmin
      .from('wms_projects')
      .insert({
        ...generalInfo,
        source_file_name: file.name,
      })
      .select('id')
      .single()

    if (projectError || !projectData) {
      console.error('Error inserting WMS project:', projectError)
      return NextResponse.json({ error: 'Failed to insert project' }, { status: 500 })
    }

    let insertedLines = 0
    if (lines.length > 0) {
      const { error: linesError, data: linesData } = await supabaseAdmin
        .from('wms_project_lines')
        .insert(
          lines.map((line) => ({
            ...line,
            project_id: projectData.id,
          }))
        )
        .select('id')

      if (linesError) {
        console.error('Error inserting WMS project lines:', linesError)
        return NextResponse.json({ error: 'Project opgeslagen, maar lijnen konden niet worden opgeslagen' }, { status: 500 })
      }

      insertedLines = linesData?.length || lines.length
    }

    return NextResponse.json({
      success: true,
      projectId: projectData.id,
      insertedLines,
      projectNo: generalInfo.project_no,
    })
  } catch (error) {
    console.error('Unexpected error importing WMS project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
