import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ScanBody {
  item_number?: string
  pallet_number?: string | null
  quantity?: number
  description?: string | null
  label_type?: string | null
  receiver?: string | null
  source?: 'camera' | 'manual' | 'edit' | 'pdf'
  raw_label?: unknown
  photo_data_url?: string | null
  note?: string | null
  scanned_by?: string | null
  force?: boolean
}

// GET /api/stock-count/sessions/:id/scans — lijst
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = Number((await params).id)
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('stock_count_scans')
    .select('*')
    .eq('session_id', sessionId)
    .order('scanned_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scans: data ?? [] })
}

// POST /api/stock-count/sessions/:id/scans — voeg een scan toe met duplicaatcheck
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = Number((await params).id)
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as ScanBody
  const item = (body.item_number || '').trim()
  if (!item) {
    return NextResponse.json({ error: 'item_number is verplicht' }, { status: 400 })
  }
  const pallet = body.pallet_number ? String(body.pallet_number).trim() || null : null
  const qty =
    Number.isFinite(Number(body.quantity)) && Number(body.quantity) >= 0
      ? Math.trunc(Number(body.quantity))
      : 1

  // Controle op open sessie
  const { data: session, error: sErr } = await supabaseAdmin
    .from('stock_count_sessions')
    .select('id,status')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) {
    return NextResponse.json({ error: 'Sessie niet gevonden' }, { status: 404 })
  }
  if (session.status !== 'open') {
    return NextResponse.json({ error: 'Sessie is gesloten' }, { status: 409 })
  }

  // Duplicaatcheck
  const dupQuery = supabaseAdmin
    .from('stock_count_scans')
    .select('id,item_number,pallet_number,quantity,scanned_at')
    .eq('session_id', sessionId)
    .eq('item_number', item)
    .limit(5)

  if (pallet === null) {
    dupQuery.is('pallet_number', null)
  } else {
    dupQuery.eq('pallet_number', pallet)
  }

  const { data: existing, error: dupErr } = await dupQuery
  if (dupErr) {
    return NextResponse.json({ error: dupErr.message }, { status: 500 })
  }

  if (existing && existing.length > 0 && !body.force) {
    return NextResponse.json(
      {
        duplicate: true,
        existing,
      },
      { status: 409 }
    )
  }

  const duplicateOf = existing && existing.length > 0 ? existing[0].id : null

  const { data, error } = await supabaseAdmin
    .from('stock_count_scans')
    .insert({
      session_id: sessionId,
      item_number: item,
      pallet_number: pallet,
      quantity: qty,
      description: body.description ?? null,
      label_type: body.label_type ?? null,
      receiver: body.receiver ?? null,
      source: body.source ?? 'camera',
      raw_label: body.raw_label ?? null,
      photo_data_url: body.photo_data_url ?? null,
      note: body.note ?? null,
      scanned_by: body.scanned_by ?? null,
      duplicate_of: duplicateOf,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ scan: data })
}
