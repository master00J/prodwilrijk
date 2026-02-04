import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true'
    let query = supabaseAdmin
      .from('storage_rental_items')
      .select('*, customer:storage_rental_customers(id,name), location:storage_rental_locations(id,name)')
      .order('start_date', { ascending: false })

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching storage rental items:', error)
      return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (error) {
    console.error('Unexpected error fetching storage rental items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customer_id,
      location_id,
      description,
      m2,
      m2_bare,
      m2_verpakt,
      price_per_m2,
      start_date,
      end_date,
      active,
      notes,
      or_number,
      customer_description,
      foresco_id,
      packing_status,
      photos_bare,
      photos_verpakt,
    } = body || {}

    if (!customer_id) {
      return NextResponse.json({ error: 'Klant is verplicht' }, { status: 400 })
    }

    const m2Val = m2 ?? m2_verpakt ?? m2_bare
    const { data, error } = await supabaseAdmin
      .from('storage_rental_items')
      .insert({
        customer_id,
        location_id: location_id ?? null,
        description: description || null,
        m2: m2Val ?? null,
        m2_bare: m2_bare ?? m2 ?? null,
        m2_verpakt: m2_verpakt ?? m2 ?? null,
        price_per_m2: price_per_m2 ?? null,
        start_date: start_date || null,
        end_date: end_date || null,
        active: active ?? true,
        notes: notes || null,
        or_number: or_number || null,
        customer_description: customer_description || null,
        foresco_id: foresco_id || null,
        packing_status: packing_status === 'verpakt' ? 'verpakt' : 'bare',
        packed_at: body.packed_at || null,
        photos_bare: Array.isArray(photos_bare) ? photos_bare : [],
        photos_verpakt: Array.isArray(photos_verpakt) ? photos_verpakt : [],
      })
      .select('*, customer:storage_rental_customers(id,name), location:storage_rental_locations(id,name)')
      .single()

    if (error) {
      console.error('Error creating storage rental item:', error)
      return NextResponse.json({ error: 'Opslag aanmaken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('Unexpected error creating storage rental item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      customer_id,
      location_id,
      description,
      m2,
      m2_bare,
      m2_verpakt,
      price_per_m2,
      start_date,
      end_date,
      active,
      notes,
      or_number,
      customer_description,
      foresco_id,
      packing_status,
      packed_at,
      photos_bare,
      photos_verpakt,
    } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (customer_id !== undefined) updateData.customer_id = customer_id
    if (location_id !== undefined) updateData.location_id = location_id ?? null
    if (description !== undefined) updateData.description = description || null
    if (m2 !== undefined) updateData.m2 = m2 ?? null
    if (m2_bare !== undefined) updateData.m2_bare = m2_bare ?? null
    if (m2_verpakt !== undefined) updateData.m2_verpakt = m2_verpakt ?? null
    if (price_per_m2 !== undefined) updateData.price_per_m2 = price_per_m2 ?? null
    if (start_date !== undefined) updateData.start_date = start_date || null
    if (end_date !== undefined) updateData.end_date = end_date || null
    if (active !== undefined) updateData.active = active
    if (notes !== undefined) updateData.notes = notes || null
    if (or_number !== undefined) updateData.or_number = or_number || null
    if (customer_description !== undefined) updateData.customer_description = customer_description || null
    if (foresco_id !== undefined) updateData.foresco_id = foresco_id || null
    if (packing_status !== undefined) updateData.packing_status = packing_status === 'verpakt' ? 'verpakt' : 'bare'
    if (packed_at !== undefined) updateData.packed_at = packed_at || null
    if (photos_bare !== undefined) updateData.photos_bare = Array.isArray(photos_bare) ? photos_bare : []
    if (photos_verpakt !== undefined) updateData.photos_verpakt = Array.isArray(photos_verpakt) ? photos_verpakt : []

    const { data, error } = await supabaseAdmin
      .from('storage_rental_items')
      .update(updateData)
      .eq('id', id)
      .select('*, customer:storage_rental_customers(id,name), location:storage_rental_locations(id,name)')
      .single()

    if (error) {
      console.error('Error updating storage rental item:', error)
      return NextResponse.json({ error: 'Opslag bijwerken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('Unexpected error updating storage rental item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('storage_rental_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting storage rental item:', error)
      return NextResponse.json({ error: 'Opslag verwijderen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting storage rental item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
