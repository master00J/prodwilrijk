import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lineId, packageId } = body || {}

    if (!lineId) {
      return NextResponse.json({ error: 'lineId is verplicht' }, { status: 400 })
    }

    if (!packageId) {
      const { error } = await supabaseAdmin
        .from('wms_package_lines')
        .delete()
        .eq('line_id', lineId)

      if (error) {
        console.error('Error removing line from package:', error)
        return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    const { error } = await supabaseAdmin
      .from('wms_package_lines')
      .upsert(
        { line_id: lineId, package_id: packageId },
        { onConflict: 'line_id' }
      )

    if (error) {
      console.error('Error assigning line to package:', error)
      return NextResponse.json({ error: 'Toewijzen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error assigning line:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
