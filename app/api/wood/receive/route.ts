import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Receive a package and add to stock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { package_id, locatie } = body

    if (!package_id || !locatie) {
      return NextResponse.json(
        { error: 'Package ID and location are required' },
        { status: 400 }
      )
    }

    // Get package details
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('wood_packages')
      .select('*')
      .eq('id', package_id)
      .single()

    if (packageError || !packageData) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      )
    }

    if (packageData.ontvangen) {
      return NextResponse.json(
        { error: 'Package already received' },
        { status: 400 }
      )
    }

    // Start transaction: update package and create stock entry
    const now = new Date().toISOString()

    // Update package as received
    const { error: updateError } = await supabaseAdmin
      .from('wood_packages')
      .update({
        ontvangen: true,
        locatie,
        ontvangen_op: now,
        updated_at: now,
      })
      .eq('id', package_id)

    if (updateError) {
      console.error('Error updating package:', updateError)
      return NextResponse.json(
        { error: 'Failed to update package' },
        { status: 500 }
      )
    }

    // Create stock entry
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from('wood_stock')
      .insert({
        package_id,
        houtsoort: packageData.houtsoort,
        pakketnummer: packageData.pakketnummer,
        dikte: packageData.exacte_dikte,
        breedte: packageData.exacte_breedte,
        lengte: packageData.exacte_lengte,
        locatie,
        aantal: packageData.planken_per_pak,
        ontvangen_op: now,
      })
      .select()
      .single()

    if (stockError) {
      console.error('Error creating stock entry:', stockError)
      return NextResponse.json(
        { error: 'Failed to create stock entry' },
        { status: 500 }
      )
    }

    // Update order received count if order_id exists
    if (packageData.order_id) {
      const { error: orderUpdateError } = await supabaseAdmin.rpc('increment_received_packages', {
        order_id: packageData.order_id,
      })

      // If RPC doesn't exist, manually update
      if (orderUpdateError) {
        const { data: orderData } = await supabaseAdmin
          .from('wood_orders')
          .select('ontvangen_pakken')
          .eq('id', packageData.order_id)
          .single()

        if (orderData) {
          await supabaseAdmin
            .from('wood_orders')
            .update({
              ontvangen_pakken: (orderData.ontvangen_pakken || 0) + 1,
              updated_at: now,
            })
            .eq('id', packageData.order_id)
        }
      }
    }

    return NextResponse.json({ success: true, data: stockData })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


