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

    // 1) Check incoming_goods_airtec (most recent first)
    const { data: incomingData } = await supabaseAdmin
      .from('incoming_goods_airtec')
      .select('kistnummer')
      .eq('item_number', itemNumber)
      .not('kistnummer', 'is', null)
      .order('datum_ontvangen', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (incomingData?.kistnummer) {
      return NextResponse.json({ kistnummer: incomingData.kistnummer })
    }

    // 2) Fallback: check packed_items_airtec (previously packed items)
    const { data: packedData } = await supabaseAdmin
      .from('packed_items_airtec')
      .select('kistnummer')
      .eq('item_number', itemNumber)
      .not('kistnummer', 'is', null)
      .order('date_packed', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (packedData?.kistnummer) {
      return NextResponse.json({ kistnummer: packedData.kistnummer })
    }

    // 3) Fallback: check airtec_unlisted_items (previously added unlisted)
    const { data: unlistedData } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('kistnummer')
      .eq('item_number', itemNumber)
      .not('kistnummer', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ kistnummer: unlistedData?.kistnummer || null })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json({ error: 'Lookup mislukt' }, { status: 500 })
  }
}
