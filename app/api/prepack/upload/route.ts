import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

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
        { error: 'No valid data to insert. Please check that all items have item_number, po_number, and amount.' },
        { status: 400 }
      )
    }

    // Insert into items_to_pack table
    const { data, error } = await supabaseAdmin
      .from('items_to_pack')
      .insert(validGoods)
      .select()

    if (error) {
      console.error('Database error:', error)
      
      // Check if it's a duplicate error
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Some items already exist in the system.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to insert items.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validGoods.length,
      message: `Successfully inserted ${data?.length || validGoods.length} items`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

