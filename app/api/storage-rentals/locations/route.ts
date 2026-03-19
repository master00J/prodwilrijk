import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true'
    let query = supabaseAdmin
      .from('storage_rental_locations')
      .select('*')
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching storage rental locations:', error)
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }

    return NextResponse.json({ locations: data || [] })
  } catch (error) {
    console.error('Unexpected error fetching storage rental locations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, capacity_m2, notes, active } = body || {}

    if (!name || String(name).trim() === '') {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('storage_rental_locations')
      .insert({
        name: String(name).trim(),
        capacity_m2: capacity_m2 ?? null,
        notes: notes || null,
        active: active ?? true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating storage rental location:', error)
      return NextResponse.json({ error: 'Locatie aanmaken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ location: data })
  } catch (error) {
    console.error('Unexpected error creating storage rental location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, capacity_m2, notes, active } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (name !== undefined) {
      if (!name || String(name).trim() === '') {
        return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
      }
      updateData.name = String(name).trim()
    }
    if (capacity_m2 !== undefined) updateData.capacity_m2 = capacity_m2 ?? null
    if (notes !== undefined) updateData.notes = notes || null
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabaseAdmin
      .from('storage_rental_locations')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating storage rental location:', error)
      return NextResponse.json({ error: 'Locatie bijwerken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ location: data })
  } catch (error) {
    console.error('Unexpected error updating storage rental location:', error)
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
      .from('storage_rental_locations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting storage rental location:', error)
      return NextResponse.json({ error: 'Locatie verwijderen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting storage rental location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
