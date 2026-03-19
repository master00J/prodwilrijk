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

    const { error: statusError } = await supabaseAdmin
      .from('wms_project_lines')
      .update({ status: 'packed', status_updated_at: new Date().toISOString() })
      .eq('id', lineId)

    if (statusError) {
      console.error('Error updating line status to packed:', statusError)
      return NextResponse.json({ error: 'Status bijwerken mislukt' }, { status: 500 })
    }

    const { data: lineImages, error: lineImagesError } = await supabaseAdmin
      .from('item_images')
      .select('image_url')
      .eq('item_type', 'wms_project_line')
      .eq('item_id', lineId)

    if (lineImagesError) {
      console.error('Error fetching line images:', lineImagesError)
      return NextResponse.json({ error: 'Foto\'s ophalen mislukt' }, { status: 500 })
    }

    if (lineImages && lineImages.length > 0) {
      const { data: packageImages, error: packageImagesError } = await supabaseAdmin
        .from('item_images')
        .select('image_url')
        .eq('item_type', 'wms_package')
        .eq('item_id', packageId)

      if (packageImagesError) {
        console.error('Error fetching package images:', packageImagesError)
        return NextResponse.json({ error: 'Foto\'s ophalen mislukt' }, { status: 500 })
      }

      const existing = new Set((packageImages || []).map((img: any) => img.image_url))
      const toInsert = lineImages
        .filter((img: any) => img.image_url && !existing.has(img.image_url))
        .map((img: any) => ({
          item_type: 'wms_package',
          item_id: packageId,
          image_url: img.image_url,
        }))

      if (toInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('item_images').insert(toInsert)
        if (insertError) {
          console.error('Error copying images to package:', insertError)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error assigning line:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
