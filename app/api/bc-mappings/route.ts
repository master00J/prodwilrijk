import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Cache 5 minuten op Vercel: de mapping verandert zelden (alleen bij expliciete
// re-import door een admin). Op client-kant wordt er nog extra sessionStorage-
// cache bovenop gelegd.
export const revalidate = 300

// Publieke GET: levert de volledige mapping-lijst zodat de client een in-memory
// lookup kan bouwen. Geen auth vereist — het gaat enkel om een publieke
// artikelnummer-vertaaltabel.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bc_item_mapping')
      .select('old_code,new_code,description')
      .order('old_code', { ascending: true })
      .limit(50000)
    if (error) throw error
    return NextResponse.json({ mappings: data || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg, mappings: [] }, { status: 500 })
  }
}
