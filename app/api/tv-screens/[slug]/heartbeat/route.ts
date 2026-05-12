import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('tv_screens')
      .update({ last_seen_at: now })
      .eq('slug', slug)
      .select('slug, name, site, active, screen_group, last_seen_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Scherm niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, screen: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Heartbeat mislukt' }, { status: 500 })
  }
}
