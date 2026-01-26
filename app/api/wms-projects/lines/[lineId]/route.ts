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
    const { status, notes } = body || {}
    const updateData: Record<string, any> = {}

    if (typeof status === 'string' && status.trim()) {
      updateData.status = status.trim()
      updateData.status_updated_at = new Date().toISOString()
    }

    if (typeof notes === 'string') {
      updateData.notes = notes
    }

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
