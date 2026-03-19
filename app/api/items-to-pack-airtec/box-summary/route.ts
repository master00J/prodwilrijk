import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const pageSize = 1000
    let offset = 0
    let allRows: Array<{ kistnummer: string }> = []
    let totalCount: number | null = null

    while (true) {
      const query = supabaseAdmin
        .from('items_to_pack_airtec')
        .select('kistnummer', { count: 'exact' })
        .eq('packed', false)
        .not('kistnummer', 'is', null)
        .neq('kistnummer', '')
        .range(offset, offset + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('Error fetching box summary:', error)
        return NextResponse.json({ error: 'Failed to fetch box summary' }, { status: 500 })
      }

      if (typeof count === 'number' && totalCount === null) {
        totalCount = count
      }

      if (!data || data.length === 0) {
        break
      }

      allRows = allRows.concat(data as Array<{ kistnummer: string }>)

      if (totalCount !== null && allRows.length >= totalCount) {
        break
      }

      offset += pageSize
    }

    const counts = new Map<string, number>()
    for (const row of allRows) {
      const key = String(row.kistnummer).trim()
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const items = Array.from(counts.entries())
      .map(([kistnummer, count]) => ({ kistnummer, count }))
      .sort((a, b) => b.count - a.count)

    const response = NextResponse.json({ items })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
