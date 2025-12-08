import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { data: prices, error } = await supabaseAdmin
      .from('airtec_prices')
      .select('*')
      .order('kistnummer', { ascending: true })

    if (error) {
      console.error('Error fetching airtec prices:', error)
      return NextResponse.json(
        { error: 'Failed to fetch prices' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      prices: prices || [],
    })
  } catch (error: any) {
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
    const { kistnummer, erp_code, price, assembly_cost, material_cost, transport_cost } = body

    if (!kistnummer || !price) {
      return NextResponse.json(
        { error: 'Kistnummer and price are required' },
        { status: 400 }
      )
    }

    // Validate kistnummer length (max 50 characters)
    if (kistnummer.length > 50) {
      return NextResponse.json(
        { error: 'Kistnummer must be 50 characters or less' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('airtec_prices')
      .insert({
        kistnummer: kistnummer.trim(),
        erp_code: erp_code?.trim() || null,
        price: parseFloat(price) || 0,
        assembly_cost: parseFloat(assembly_cost) || 0,
        material_cost: parseFloat(material_cost) || 0,
        transport_cost: parseFloat(transport_cost) || 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting airtec price:', error)
      
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A price for this kistnummer already exists' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to add price' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      price: data,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

