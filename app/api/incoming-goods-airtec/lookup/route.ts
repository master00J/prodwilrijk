import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemNumber = searchParams.get('item_number')?.trim() || ''

    if (!itemNumber) {
      return NextResponse.json({ kistnummer: null })
    }

    const { data, error } = await supabaseAdmin
      .from('incoming_goods_airtec')
      .select('kistnummer')
      .eq('item_number', itemNumber)
      .order('datum_ontvangen', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error looking up box number:', error)
      return NextResponse.json({ error: 'Failed to lookup box number' }, { status: 500 })
    }

    return NextResponse.json({ kistnummer: data?.kistnummer || null })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
