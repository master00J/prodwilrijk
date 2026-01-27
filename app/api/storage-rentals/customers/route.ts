import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true'
    let query = supabaseAdmin
      .from('storage_rental_customers')
      .select('*')
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching storage rental customers:', error)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    return NextResponse.json({ customers: data || [] })
  } catch (error) {
    console.error('Unexpected error fetching storage rental customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, notes, active } = body || {}

    if (!name || String(name).trim() === '') {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('storage_rental_customers')
      .insert({
        name: String(name).trim(),
        notes: notes || null,
        active: active ?? true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating storage rental customer:', error)
      return NextResponse.json({ error: 'Klant aanmaken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('Unexpected error creating storage rental customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, notes, active } = body || {}

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
    if (notes !== undefined) updateData.notes = notes || null
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabaseAdmin
      .from('storage_rental_customers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating storage rental customer:', error)
      return NextResponse.json({ error: 'Klant bijwerken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('Unexpected error updating storage rental customer:', error)
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
      .from('storage_rental_customers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting storage rental customer:', error)
      return NextResponse.json({ error: 'Klant verwijderen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting storage rental customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
