import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  batchHasIndusRows,
  batchHasOilfreeRows,
  buildIndusXmlFile,
  buildOilfreeXmlFiles,
  isRowIncludedInExport,
  type PackedReviewRow,
  type XmlFile,
} from '@/lib/grote-inpak/packed-review'

function normalizeReviewRows(rows: any[], batchId: number): PackedReviewRow[] {
  return rows
    .filter(row => Number(row.batch_id ?? batchId) === batchId)
    .map(row => ({
      id: row.id,
      batch_id: row.batch_id,
      row_index: row.row_index,
      source_type: ['packed', 'packed_n', 'packed_y'].includes(row.source_type)
        ? row.source_type
        : 'packed_n',
      case_label: String(row.case_label || '').trim(),
      series: String(row.series || '').trim(),
      case_type: String(row.case_type || '').trim(),
      packed_date: String(row.packed_date || '').trim(),
      excluded: row.excluded === true,
      notes: row.notes ?? null,
    }))
}

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  po_apf: 'MF-4536602',
  po_s4: 'MF-4536602',
  po_s5: 'MF-4536602',
  po_s9: 'MF-4536602',
  po_indus: 'MF-4581681',
  indus_suffix: 'KC',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const batchId = Number((await params).id)
    if (!batchId) {
      return NextResponse.json({ error: 'Ongeldige batch id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('grote_inpak_packed_import_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    if (batchError) throw batchError

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('grote_inpak_packed_import_rows')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_index', { ascending: true })

    if (rowsError) throw rowsError

    const dbRows = (rows || []) as PackedReviewRow[]
    const bodyRows = Array.isArray(body.rows) ? normalizeReviewRows(body.rows, batchId) : null
    const reviewRows = bodyRows && bodyRows.length > 0 ? bodyRows : normalizeReviewRows(dbRows, batchId)

    if (reviewRows.length === 0) {
      return NextResponse.json({ error: 'Geen regels gevonden voor deze batch' }, { status: 400 })
    }

    const includedCount = reviewRows.filter(isRowIncludedInExport).length
    if (includedCount === 0) {
      return NextResponse.json(
        { error: 'Geen actieve regels: vink minstens één regel aan bij Gebruik.' },
        { status: 400 }
      )
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('grote_inpak_packed_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (settingsError) throw settingsError

    const config = settings || DEFAULTS
    const files: XmlFile[] = []

    if (batchHasOilfreeRows(reviewRows)) {
      files.push(...buildOilfreeXmlFiles(reviewRows, {
        apf: config.po_apf || DEFAULTS.po_apf,
        s4: config.po_s4 || DEFAULTS.po_s4,
        s5: config.po_s5 || DEFAULTS.po_s5,
        s9: config.po_s9 || DEFAULTS.po_s9,
      }))
    }

    if (batchHasIndusRows(reviewRows)) {
      const indusSuffix =
        String(body.item_suffix || config.indus_suffix || DEFAULTS.indus_suffix || '').trim()
      const indusFile = buildIndusXmlFile(
        reviewRows,
        config.po_indus || DEFAULTS.po_indus,
        indusSuffix
      )
      if (indusFile) files.push(indusFile)
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Geen XML-bestanden aangemaakt' }, { status: 400 })
    }

    if (batchHasOilfreeRows(reviewRows)) {
      const packedRows = reviewRows
        .filter(isRowIncludedInExport)
        .filter(row => row.source_type === 'packed')
        .map(row => ({
          case_label: row.case_label,
          case_type: row.case_type,
          packed_date: row.packed_date,
          packed_file: batch.source_file,
        }))

      if (packedRows.length > 0) {
        const { error: packedError } = await supabaseAdmin
          .from('grote_inpak_packed')
          .insert(packedRows)

        if (packedError) throw packedError
      }
    }

    const { error: statusError } = await supabaseAdmin
      .from('grote_inpak_packed_import_batches')
      .update({
        status: 'exported',
        exported_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    if (statusError) throw statusError

    return NextResponse.json({
      success: true,
      files,
    })
  } catch (error: any) {
    console.error('Packed review XML export error:', error)
    return NextResponse.json(
      { error: error.message || 'Packed review XML export mislukt' },
      { status: 500 }
    )
  }
}
