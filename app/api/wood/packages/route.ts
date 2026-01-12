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


