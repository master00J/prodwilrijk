import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'draft'
    const limit = Number(request.nextUrl.searchParams.get('limit') || 20)

    let batchQuery = supabaseAdmin
      .from('grote_inpak_packed_import_batches')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      batchQuery = batchQuery.eq('status', status)
    }

    const { data: batches, error: batchError } = await batchQuery
    if (batchError) throw batchError

    const batchIds = (batches || []).map((batch: any) => batch.id)
    const rowsByBatch = new Map<number, any[]>()

    if (batchIds.length > 0) {
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('grote_inpak_packed_import_rows')
        .select('*')
        .in('batch_id', batchIds)
        .order('row_index', { ascending: true })

      if (rowsError) throw rowsError

      ;(rows || []).forEach((row: any) => {
        rowsByBatch.set(row.batch_id, [...(rowsByBatch.get(row.batch_id) || []), row])
      })
    }

    return NextResponse.json({
      data: (batches || []).map((batch: any) => ({
        ...batch,
        rows: rowsByBatch.get(batch.id) || [],
      })),
    })
  } catch (error: any) {
    console.error('Error fetching packed review batches:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching packed review batches' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body.rows) ? body.rows : []
    const batchId = Number(body.batchId)
    const status = body.status ? String(body.status) : null

    if (!batchId || rows.length === 0) {
      return NextResponse.json({ error: 'batchId en rows zijn verplicht' }, { status: 400 })
    }

    for (const row of rows) {
      const id = Number(row.id)
      if (!id) continue

      const { error } = await supabaseAdmin
        .from('grote_inpak_packed_import_rows')
        .update({
          case_label: String(row.case_label || '').trim(),
          series: String(row.series || '').trim(),
          case_type: String(row.case_type || '').trim(),
          packed_date: String(row.packed_date || '').trim(),
          excluded: row.excluded === true,
          notes: row.notes ? String(row.notes) : null,
        })
        .eq('id', id)
        .eq('batch_id', batchId)

      if (error) throw error
    }

    if (status) {
      const { error } = await supabaseAdmin
        .from('grote_inpak_packed_import_batches')
        .update({ status })
        .eq('id', batchId)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating packed review rows:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating packed review rows' },
      { status: 500 }
    )
  }
}
