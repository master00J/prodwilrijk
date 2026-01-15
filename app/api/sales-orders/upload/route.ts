import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array of items.' },
        { status: 400 }
      )
    }

    // Validate and prepare data
    const validItems = items
      .map((item: any) => {
        const itemNumber = item.item_number?.toString().trim()
        const price = item.price ? parseFloat(item.price) : null

        if (!itemNumber || price === null || isNaN(price) || price < 0) {
          return null
        }

        return {
          item_number: itemNumber,
          price: price,
          description: item.description || null,
        }
      })
      .filter((item: any) => item !== null)

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid items to insert. Please check that all items have item_number and price.' },
        { status: 400 }
      )
    }

    // Insert into sales_orders table
    const { data, error } = await supabaseAdmin
      .from('sales_orders')
      .insert(validItems)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to insert sales orders: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validItems.length,
      message: `Successfully inserted ${data?.length || validItems.length} sales orders`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
