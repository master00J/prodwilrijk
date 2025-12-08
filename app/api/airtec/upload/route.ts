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

    // Validate and filter data for Airtec
    const validGoods = goods
      .map((item) => ({
        beschrijving: item.beschrijving?.toString().trim() || null,
        item_number: item.item_number?.toString().trim() || null,
        lot_number: item.lot_number?.toString().trim() || null,
        datum_opgestuurd: item.datum_opgestuurd || null,
        kistnummer: item.kistnummer ? String(item.kistnummer).trim().slice(-3) : null, // Last 3 characters
        divisie: item.divisie?.toString().trim() || null,
        quantity: item.quantity ? Number(item.quantity) : 1,
      }))
      .filter(
        // At minimum, we need item_number or beschrijving
        (item) => (item.item_number || item.beschrijving) && item.quantity > 0
      )

    if (validGoods.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to insert. Please check that all items have at least Item Number or Description, and a valid Quantity.' },
        { status: 400 }
      )
    }

    // Insert into incoming_goods_airtec table
    const { data, error } = await supabaseAdmin
      .from('incoming_goods_airtec')
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

