import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stockData } = body

    if (!stockData || !Array.isArray(stockData)) {
      return NextResponse.json(
        { error: 'Stock data array is required' },
        { status: 400 }
      )
    }

    // Upsert stock data (update if exists, insert if not)
    // Use item_number + location as unique key
    for (const item of stockData) {
      await supabaseAdmin
        .from('grote_inpak_stock')
        .upsert({
          item_number: item.item_number,
          location: item.location,
          quantity: item.quantity || 0,
          erp_code: item.erp_code || null,
        }, {
          onConflict: 'item_number,location',
          ignoreDuplicates: false,
        })
    }

    return NextResponse.json({
      success: true,
      count: stockData.length,
    })
  } catch (error: any) {
    console.error('Error saving stock:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving stock data' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemNumber = searchParams.get('item_number')
    const location = searchParams.get('location')

    let query = supabaseAdmin
      .from('grote_inpak_stock')
      .select('*')
      .order('item_number', { ascending: true })

    if (itemNumber) {
      query = query.eq('item_number', itemNumber)
    }

    if (location) {
      query = query.eq('location', location)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Aggregate by item_number if needed
    const aggregated = data?.reduce((acc: any, item: any) => {
      const key = item.item_number
      if (!acc[key]) {
        acc[key] = {
          item_number: item.item_number,
          erp_code: item.erp_code,
          locations: [],
          total_quantity: 0,
        }
      }
      acc[key].locations.push({
        location: item.location,
        quantity: item.quantity || 0,
      })
      acc[key].total_quantity += item.quantity || 0
      return acc
    }, {})

    return NextResponse.json({ 
      data: data || [], 
      aggregated: aggregated ? Object.values(aggregated) : [],
      count: data?.length || 0 
    })
  } catch (error: any) {
    console.error('Error fetching stock:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    )
  }
}

