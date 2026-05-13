import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  buildIndusXmlFile,
  buildOilfreeXmlFiles,
  type PackedReviewRow,
  type XmlFile,
} from '@/lib/grote-inpak/packed-review'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  po_apf: 'MF-4536602',
  po_s4: 'MF-4536602',
  po_s5: 'MF-4536602',
  po_s9: 'MF-4536602',
  po_indus: 'MF-4581681',
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
    const itemSuffix = String(body.item_suffix || '').trim()

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

    const reviewRows = (rows || []) as PackedReviewRow[]
    if (reviewRows.length === 0) {
      return NextResponse.json({ error: 'Geen regels gevonden voor deze batch' }, { status: 400 })
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('grote_inpak_packed_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (settingsError) throw settingsError

    const config = settings || DEFAULTS
    const files: XmlFile[] = []

    if (batch.source_type === 'packed') {
      files.push(...buildOilfreeXmlFiles(reviewRows, {
        apf: config.po_apf || DEFAULTS.po_apf,
        s4: config.po_s4 || DEFAULTS.po_s4,
        s5: config.po_s5 || DEFAULTS.po_s5,
        s9: config.po_s9 || DEFAULTS.po_s9,
      }))
    } else {
      const indusFile = buildIndusXmlFile(
        reviewRows,
        config.po_indus || DEFAULTS.po_indus,
        itemSuffix
      )
      if (indusFile) files.push(indusFile)
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Geen XML-bestanden aangemaakt' }, { status: 400 })
    }

    if (batch.source_type === 'packed') {
      const packedRows = reviewRows
        .filter(row => !row.excluded)
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
