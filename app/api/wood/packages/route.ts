import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Register a package for receiving
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      order_id,
      pakketnummer,
      houtsoort,
      exacte_dikte,
      exacte_breedte,
      exacte_lengte,
      planken_per_pak,
      opmerking,
    } = body

    if (!pakketnummer || !houtsoort || !exacte_dikte || !exacte_breedte || !exacte_lengte || !planken_per_pak) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if package number already exists
    const { data: existing } = await supabaseAdmin
      .from('wood_packages')
      .select('id')
      .eq('pakketnummer', pakketnummer)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Package number already exists' },
        { status: 400 }
      )
    }

    // If linked to an order, ensure there are still open packages
    let orderData: { id: number; ontvangen_pakken: number | null; aantal_pakken: number } | null = null
    if (order_id) {
      const { data: orderRow, error: orderError } = await supabaseAdmin
        .from('wood_orders')
        .select('id, ontvangen_pakken, aantal_pakken')
        .eq('id', order_id)
        .single()

      if (orderError || !orderRow) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }

      const received = orderRow.ontvangen_pakken || 0
      if (received >= orderRow.aantal_pakken) {
        return NextResponse.json(
          { error: 'Order already fully received' },
          { status: 400 }
        )
      }

      orderData = orderRow
    }

    const { data, error } = await supabaseAdmin
      .from('wood_packages')
      .insert({
        order_id: order_id || null,
        pakketnummer,
        houtsoort,
        exacte_dikte: parseFloat(exacte_dikte),
        exacte_breedte: parseFloat(exacte_breedte),
        exacte_lengte: parseInt(exacte_lengte),
        planken_per_pak: parseInt(planken_per_pak),
        opmerking: opmerking || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating package:', error)
      return NextResponse.json(
        { error: 'Failed to create package', details: error.message },
        { status: 500 }
      )
    }

    // Update order received count when a package is registered
    if (orderData) {
      const { error: updateOrderError } = await supabaseAdmin
        .from('wood_orders')
        .update({
          ontvangen_pakken: (orderData.ontvangen_pakken || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.id)

      if (updateOrderError) {
        console.error('Error updating order received count:', updateOrderError)
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get packages (waiting for location or received)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const received = searchParams.get('received')
    const pakketnummer = searchParams.get('pakketnummer')

    let query = supabaseAdmin
      .from('wood_packages')
      .select('*')
      .order('aangemeld_op', { ascending: false })

    if (received === 'false') {
      query = query.eq('ontvangen', false)
    } else if (received === 'true') {
      query = query.eq('ontvangen', true)
    }

    if (pakketnummer) {
      query = query.eq('pakketnummer', pakketnummer)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching packages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch packages' },
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



