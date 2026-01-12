import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Pick wood from stock (move to consumption)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stock_id, aantal, opmerking } = body

    if (!stock_id || !aantal) {
      return NextResponse.json(
        { error: 'Stock ID and aantal are required' },
        { status: 400 }
      )
    }

    // Get stock item
    const { data: stockItem, error: stockError } = await supabaseAdmin
      .from('wood_stock')
      .select('*')
      .eq('id', stock_id)
      .single()

    if (stockError || !stockItem) {
      return NextResponse.json(
        { error: 'Stock item not found' },
        { status: 404 }
      )
    }

    if (stockItem.aantal < aantal) {
      return NextResponse.json(
        { error: 'Not enough stock available' },
        { status: 400 }
      )
    }

    // Create consumption entry
    const { data: consumptionData, error: consumptionError } = await supabaseAdmin
      .from('wood_consumption')
      .insert({
        stock_id,
        houtsoort: stockItem.houtsoort,
        lengte: stockItem.lengte,
        breedte: stockItem.breedte,
        dikte: stockItem.dikte,
        aantal: parseInt(aantal),
        opmerking: opmerking || null,
      })
      .select()
      .single()

    if (consumptionError) {
      console.error('Error creating consumption entry:', consumptionError)
      return NextResponse.json(
        { error: 'Failed to create consumption entry' },
        { status: 500 }
      )
    }

    // Update stock quantity
    const newAantal = stockItem.aantal - parseInt(aantal)
    
    if (newAantal <= 0) {
      // Delete stock item if all consumed
      await supabaseAdmin
        .from('wood_stock')
        .delete()
        .eq('id', stock_id)
    } else {
      // Update stock quantity
      await supabaseAdmin
        .from('wood_stock')
        .update({
          aantal: newAantal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock_id)
    }

    return NextResponse.json({ success: true, data: consumptionData })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


