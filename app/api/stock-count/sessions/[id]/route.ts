import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/stock-count/sessions/:id — session + scans
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = Number(params.id)
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }
  const { data: session, error: sErr } = await supabaseAdmin
    .from('stock_count_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 404 })
  }
  const { data: scans, error: scErr } = await supabaseAdmin
    .from('stock_count_scans')
    .select('*')
    .eq('session_id', sessionId)
    .order('scanned_at', { ascending: false })
  if (scErr) {
    return NextResponse.json({ error: scErr.message }, { status: 500 })
  }
  return NextResponse.json({ session, scans: scans ?? [] })
}

// PATCH /api/stock-count/sessions/:id — sluit (of hernoem) sessie
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = Number(params.id)
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: 'Ongeldige id' }, { status: 400 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    status?: 'open' | 'closed'
    name?: string
    note?: string
  }
  const update: Record<string, unknown> = {}
  if (body.status === 'open' || body.status === 'closed') {
    update.status = body.status
    update.closed_at = body.status === 'closed' ? new Date().toISOString() : null
  }
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.note === 'string') update.note = body.note

  const { data, error } = await supabaseAdmin
    .from('stock_count_sessions')
    .update(update)
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ session: data })
}
