import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    let query = supabaseAdmin
      .from('items_to_pack_airtec')
      .select('kistnummer, id.count()')
      .eq('packed', false)
      .not('kistnummer', 'is', null)
      .neq('kistnummer', '')

    const { data, error } = await query

    if (error) {
      console.error('Error fetching box summary:', error)
      return NextResponse.json({ error: 'Failed to fetch box summary' }, { status: 500 })
    }

    const items = (data || [])
      .map((row: any) => ({
        kistnummer: row.kistnummer,
        count: Number(row.id_count ?? row.count ?? 0),
      }))
      .sort((a, b) => b.count - a.count)

    const response = NextResponse.json({ items })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
