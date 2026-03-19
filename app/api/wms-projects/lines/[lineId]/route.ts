import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: { lineId: string } }) {
  try {
    const lineId = Number(params.lineId)
    if (!Number.isFinite(lineId)) {
      return NextResponse.json({ error: 'Invalid line id' }, { status: 400 })
    }

    const body = await request.json()
    const {
      status,
      notes,
      storage_m2,
      storage_location,
      dimensions_confirmed,
      length_cm,
      width_cm,
      height_cm,
      length_mm,
      width_mm,
      height_mm,
      received_at,
      shipped_at,
    } = body || {}
    const updateData: Record<string, any> = {}

    if (typeof status === 'string' && status.trim()) {
      updateData.status = status.trim()
      updateData.status_updated_at = new Date().toISOString()
    }

    if (typeof notes === 'string') {
      updateData.notes = notes
    }

    if (storage_m2 !== undefined) {
      updateData.storage_m2 = storage_m2 === null || storage_m2 === '' ? null : storage_m2
    }

    if (storage_location !== undefined) {
      updateData.storage_location = storage_location || null
    }

    if (dimensions_confirmed !== undefined) {
      updateData.dimensions_confirmed = Boolean(dimensions_confirmed)
    }

    if (length_cm !== undefined) updateData.length_cm = length_cm === '' ? null : length_cm
    if (width_cm !== undefined) updateData.width_cm = width_cm === '' ? null : width_cm
    if (height_cm !== undefined) updateData.height_cm = height_cm === '' ? null : height_cm
    if (length_mm !== undefined) updateData.length_mm = length_mm === '' ? null : length_mm
    if (width_mm !== undefined) updateData.width_mm = width_mm === '' ? null : width_mm
    if (height_mm !== undefined) updateData.height_mm = height_mm === '' ? null : height_mm

    if (received_at !== undefined) updateData.received_at = received_at || null
    if (shipped_at !== undefined) updateData.shipped_at = shipped_at || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('wms_project_lines')
      .update(updateData)
      .eq('id', lineId)

    if (error) {
      console.error('Error updating WMS line:', error)
      return NextResponse.json({ error: 'Failed to update line' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error updating WMS line:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
