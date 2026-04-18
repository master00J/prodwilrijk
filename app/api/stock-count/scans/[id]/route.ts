import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PATCH /api/stock-count/scans/:id — bewerk scan (item, pallet, qty, note)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scanId = Number(params.id)
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    item_number?: string
    pallet_number?: string | null
    quantity?: number
    note?: string | null
    description?: string | null
    receiver?: string | null
  }
  const update: Record<string, unknown> = {}
  if (typeof body.item_number === 'string' && body.item_number.trim()) {
    update.item_number = body.item_number.trim()
  }
  if (body.pallet_number !== undefined) {
    update.pallet_number = body.pallet_number
      ? String(body.pallet_number).trim() || null
      : null
  }
  if (body.quantity !== undefined && Number.isFinite(Number(body.quantity))) {
    update.quantity = Math.max(0, Math.trunc(Number(body.quantity)))
  }
  if (body.note !== undefined) update.note = body.note
  if (body.description !== undefined) update.description = body.description
  if (body.receiver !== undefined) {
    update.receiver =
      typeof body.receiver === 'string'
        ? body.receiver.trim() || null
        : null
  }

  const { data, error } = await supabaseAdmin
    .from('stock_count_scans')
    .update(update)
    .eq('id', scanId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scan: data })
}

// DELETE /api/stock-count/scans/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scanId = Number(params.id)
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('stock_count_scans')
    .delete()
    .eq('id', scanId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
