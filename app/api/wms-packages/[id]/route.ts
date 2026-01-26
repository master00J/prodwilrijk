import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const packageId = Number(params.id)
    if (!Number.isFinite(packageId)) {
      return NextResponse.json({ error: 'Invalid package id' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    if ('package_no' in body) updateData.package_no = body.package_no || null
    if ('received_at' in body) updateData.received_at = body.received_at || null
    if ('load_in_at' in body) updateData.load_in_at = body.load_in_at || null
    if ('load_out_at' in body) updateData.load_out_at = body.load_out_at || null
    if ('storage_location' in body) updateData.storage_location = body.storage_location || null
    if ('storage_m2' in body) updateData.storage_m2 = body.storage_m2 ?? null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('wms_packages')
      .update(updateData)
      .eq('id', packageId)

    if (error) {
      console.error('Error updating WMS package:', error)
      return NextResponse.json({ error: 'Pakket bijwerken mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error updating WMS package:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const packageId = Number(params.id)
    if (!Number.isFinite(packageId)) {
      return NextResponse.json({ error: 'Invalid package id' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    if (body.package_no !== undefined) updateData.package_no = body.package_no
    if (body.received_at !== undefined) updateData.received_at = body.received_at || null
    if (body.load_in_at !== undefined) updateData.load_in_at = body.load_in_at || null
    if (body.load_out_at !== undefined) updateData.load_out_at = body.load_out_at || null
    if (body.storage_location !== undefined) updateData.storage_location = body.storage_location || null
    if (body.storage_m2 !== undefined) updateData.storage_m2 = body.storage_m2 || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('wms_packages').update(updateData).eq('id', packageId)
    if (error) {
      console.error('Error updating WMS package:', error)
      return NextResponse.json({ error: 'Failed to update package' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error updating WMS package:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
