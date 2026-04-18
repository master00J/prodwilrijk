import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/stock-count/sessions/active — huidige open sessie (of null)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('stock_count_sessions')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ session: data ?? null })
}
