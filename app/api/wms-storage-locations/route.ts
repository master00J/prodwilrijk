import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('wms_storage_locations')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching storage locations:', error)
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }

    const { data: lineStorage } = await supabaseAdmin
      .from('wms_project_lines')
      .select('storage_location, storage_m2')

    const usageByLocation: Record<string, number> = {}
    lineStorage?.forEach((line: any) => {
      const location = String(line.storage_location || '').trim()
      if (!location) return
      const m2 = Number(line.storage_m2 || 0)
      usageByLocation[location] = (usageByLocation[location] || 0) + m2
    })

    const response = NextResponse.json({ locations: data || [], usageByLocation })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error fetching storage locations:', error)
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
      .from('wms_storage_locations')
      .insert({
        name: String(name).trim(),
        capacity_m2: capacity_m2 ?? null,
        notes: notes || null,
        active: active ?? true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating storage location:', error)
      return NextResponse.json({ error: 'Locatie aanmaken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ location: data })
  } catch (error) {
    console.error('Unexpected error creating storage location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
