import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Create new wood orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Can be single order or array of orders
    const orders = Array.isArray(body) ? body : [body]
    
    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'No orders provided' },
        { status: 400 }
      )
    }

    // Validate and prepare orders
    const ordersToInsert = orders.map((order: any) => {
      if (!order.houtsoort || !order.min_lengte || !order.dikte || 
          !order.breedte || !order.aantal_pakken) {
        throw new Error('Missing required fields: houtsoort, min_lengte, dikte, breedte, aantal_pakken')
      }

      return {
        houtsoort: order.houtsoort,
        min_lengte: parseInt(order.min_lengte),
        dikte: parseInt(order.dikte),
        breedte: parseInt(order.breedte),
        aantal_pakken: parseInt(order.aantal_pakken),
        planken_per_pak: parseInt(order.planken_per_pak || 50),
        opmerkingen: order.opmerkingen || null,
        priority: order.priority || false,
      }
    })

    const { data, error } = await supabaseAdmin
      .from('wood_orders')
      .insert(ordersToInsert)
      .select()

    if (error) {
      console.error('Error creating wood orders:', error)
      return NextResponse.json(
        { error: 'Failed to create orders', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Get all wood orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const archived = searchParams.get('archived') === 'true'

    let query = supabaseAdmin
      .from('wood_orders')
      .select('*')
      .order('besteld_op', { ascending: false })

    if (!archived) {
      query = query.eq('gearchiveerd', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching wood orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
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



