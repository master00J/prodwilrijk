import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('prepack_unlisted_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prepack unlisted items:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_number, quantity, description, po_line, supplier, label_date, delivery_notice, category, opmerking } = body

    if (!item_number?.trim()) {
      return NextResponse.json({ error: 'Item number is verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('prepack_unlisted_items')
      .insert({
        item_number: String(item_number).trim(),
        quantity: quantity != null ? Math.max(1, parseInt(String(quantity), 10) || 1) : 1,
        description: description ? String(description).trim() : null,
        po_line: po_line ? String(po_line).trim() : null,
        supplier: supplier ? String(supplier).trim() : null,
        label_date: label_date ? String(label_date).trim() : null,
        delivery_notice: delivery_notice ? String(delivery_notice).trim() : null,
        category: category === 'd_nummer' ? 'd_nummer' : 'extra_pallet',
        opmerking: opmerking ? String(opmerking).trim() : null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting prepack unlisted item:', error)
      return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ids } = body

    const toDelete: number[] = ids || (id ? [id] : [])
    if (toDelete.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('prepack_unlisted_items')
      .delete()
      .in('id', toDelete)

    if (error) {
      console.error('Error deleting prepack unlisted items:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: toDelete.length })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
