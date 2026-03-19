import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const locationId = Number(params.id)
    if (!Number.isFinite(locationId)) {
      return NextResponse.json({ error: 'Invalid location id' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    if ('name' in body) updateData.name = body.name || null
    if ('capacity_m2' in body) updateData.capacity_m2 = body.capacity_m2 ?? null
    if ('notes' in body) updateData.notes = body.notes || null
    if ('active' in body) updateData.active = Boolean(body.active)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('wms_storage_locations')
      .update(updateData)
      .eq('id', locationId)

    if (error) {
      console.error('Error updating storage location:', error)
      return NextResponse.json({ error: 'Locatie bijwerken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error updating storage location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const locationId = Number(params.id)
    if (!Number.isFinite(locationId)) {
      return NextResponse.json({ error: 'Invalid location id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('wms_storage_locations')
      .delete()
      .eq('id', locationId)

    if (error) {
      console.error('Error deleting storage location:', error)
      return NextResponse.json({ error: 'Locatie verwijderen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting storage location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export {}