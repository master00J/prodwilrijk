import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('incoming_goods')
      .select('*')
      .order('date_added', { ascending: false })

    if (error) {
      console.error('Error fetching incoming goods:', error)
      return NextResponse.json(
        { error: 'Failed to fetch incoming goods' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const goods = Array.isArray(body) ? body : [body]

    if (!Array.isArray(goods) || goods.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array.' },
        { status: 400 }
      )
    }

    // Validate and filter data
    const validGoods = goods
      .map((item) => ({
        item_number: item.item_number?.toString().trim() || null,
        po_number: item.po_number?.toString().trim() || null,
        amount: item.amount ? Number(item.amount) : null,
      }))
      .filter(
        (item) => item.item_number && item.po_number && item.amount && item.amount > 0
      )

    if (validGoods.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to insert.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('incoming_goods')
      .insert(validGoods)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to insert items.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validGoods.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

