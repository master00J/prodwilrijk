import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Get wood stock
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabaseAdmin
      .from('wood_stock')
      .select('*')
      .order('ontvangen_op', { ascending: false })

    if (search) {
      const normalized = search.toLowerCase().trim()
      const dimensionMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)/)

      if (dimensionMatch) {
        const toNumber = (value: string) => Number(value.replace(',', '.'))
        const dikte = toNumber(dimensionMatch[1])
        const breedte = toNumber(dimensionMatch[2])
        const lengte = toNumber(dimensionMatch[3])

        query = query
          .eq('dikte', dikte)
          .eq('breedte', breedte)
          .eq('lengte', lengte)
      } else {
        query = query.or(`houtsoort.ilike.%${search}%,locatie.ilike.%${search}%,pakketnummer.ilike.%${search}%`)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching wood stock:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stock' },
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

// PUT - Update stock item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Stock ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('wood_stock')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating stock:', error)
      return NextResponse.json(
        { error: 'Failed to update stock' },
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



