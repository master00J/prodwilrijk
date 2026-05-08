import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isValidPoFloorStatus } from '@/lib/grote-inpak/po-floor-status'

export const dynamic = 'force-dynamic'

/**
 * POST /api/grote-inpak/production-orders/floor-status
 * Manuele vloerstatus per lijn (prod_order_no + item_no + bc_source).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const prod_order_no = String(body.prod_order_no ?? '').trim()
    const item_no = String(body.item_no ?? '').trim()
    const bc_source = body.bc_source === 'legacy' ? 'legacy' : 'bc36'
    const floor_status = body.floor_status
    const note =
      body.note != null && String(body.note).trim() !== '' ? String(body.note).trim().slice(0, 500) : null

    if (!prod_order_no || !item_no) {
      return NextResponse.json({ error: 'prod_order_no en item_no zijn verplicht' }, { status: 400 })
    }
    if (!isValidPoFloorStatus(floor_status)) {
      return NextResponse.json({ error: 'Ongeldige vloerstatus' }, { status: 400 })
    }

    const { data: line, error: lineErr } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('id')
      .eq('prod_order_no', prod_order_no)
      .eq('item_no', item_no)
      .eq('bc_source', bc_source)
      .maybeSingle()

    if (lineErr) throw lineErr
    if (!line) {
      return NextResponse.json(
        { error: 'Geen productieorderlijn gevonden voor deze combinatie (upload eerst de PO-lijst)' },
        { status: 404 },
      )
    }

    const row = {
      prod_order_no,
      item_no,
      bc_source,
      floor_status,
      note,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('grote_inpak_production_order_floor_status')
      .upsert(row, { onConflict: 'prod_order_no,item_no,bc_source' })

    if (upsertErr) throw upsertErr

    return NextResponse.json({ success: true, ...row })
  } catch (error: any) {
    console.error('floor-status POST:', error)
    return NextResponse.json({ error: error.message || 'Opslaan mislukt' }, { status: 500 })
  }
}
