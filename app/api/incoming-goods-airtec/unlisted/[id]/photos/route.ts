import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET = 'airtec-unlisted-photos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Ongeldig item-id' }, { status: 400 })
    }

    const formData = await request.formData()
    const photos = formData.getAll('photos') as File[]
    const singlePhoto = formData.get('photo') as File | null
    const allPhotos = photos.length > 0 ? photos : singlePhoto ? [singlePhoto] : []

    if (allPhotos.length === 0) {
      return NextResponse.json(
        { error: 'Geen foto\'s geselecteerd' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('photo_urls')
      .eq('id', idNum)
      .single()

    const currentUrls: string[] = Array.isArray(existing?.photo_urls) ? existing.photo_urls : []

    const uploadedUrls: string[] = []
    for (const photo of allPhotos) {
      if (!photo.size) continue
      const arrayBuffer = await photo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileExt = photo.name.split('.').pop() || 'jpg'
      const fileName = `item-${idNum}/${timestamp}_${randomStr}.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(fileName, buffer, { contentType: photo.type || 'image/jpeg', upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl)
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'Upload mislukt' },
        { status: 500 }
      )
    }

    const updatedUrls = [...currentUrls, ...uploadedUrls]

    const { error: updateError } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .update({ photo_urls: updatedUrls })
      .eq('id', idNum)

    if (updateError) {
      console.error('Error updating photo_urls:', updateError)
      return NextResponse.json(
        { error: 'Foto\'s geüpload maar koppeling mislukt' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      photoUrls: uploadedUrls,
      allUrls: updatedUrls,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Interne fout' },
      { status: 500 }
    )
  }
}
