import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/stock-count/sessions — lijst van sessies (nieuwste eerst)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('stock_count_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ sessions: data ?? [] })
}

// POST /api/stock-count/sessions — nieuwe sessie openen (sluit eventuele open sessie)
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      created_by?: string
      close_previous?: boolean
    }

    const name = (body.name && body.name.trim()) || `Telling ${new Date().toLocaleString('nl-BE')}`

    if (body.close_previous !== false) {
      await supabaseAdmin
        .from('stock_count_sessions')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('status', 'open')
    }

    const { data, error } = await supabaseAdmin
      .from('stock_count_sessions')
      .insert({
        name,
        status: 'open',
        created_by: body.created_by ?? null,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
