import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_number, po_number, amount } = body

    if (!item_number?.trim()) {
      return NextResponse.json({ error: 'Item number is verplicht' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('items_to_pack')
      .select('id')
      .eq('item_number', item_number.trim())
      .eq('po_number', po_number?.trim() || '')
      .eq('packed', false)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Item ${item_number} met pallet nr ${po_number} staat al in Items to Pack`,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('items_to_pack')
      .insert({
        item_number: item_number.trim(),
        po_number: po_number?.trim() || '',
        amount: amount != null ? Math.max(1, parseInt(String(amount), 10) || 1) : 1,
        date_added: new Date().toISOString(),
        priority: false,
        measurement: false,
        packed: false,
        problem: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding to items_to_pack:', error)
      return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
