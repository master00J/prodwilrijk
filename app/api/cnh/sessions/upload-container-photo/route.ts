import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/upload-container-photo - Upload container photo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sessionId = formData.get('sessionId')
    const photos = formData.getAll('photos') as File[]
    const singlePhoto = formData.get('photo') as File | null
    const allPhotos = photos.length > 0 ? photos : singlePhoto ? [singlePhoto] : []

    if (!sessionId || allPhotos.length === 0) {
      return NextResponse.json(
        { error: 'sessionId and photo(s) are required' },
        { status: 400 }
      )
    }

    const uploadedUrls: string[] = []

    for (const photo of allPhotos) {
      const arrayBuffer = await photo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileExt = photo.name.split('.').pop() || 'jpg'
      const fileName = `cnh-container-photos/${sessionId}/${timestamp}_${randomStr}.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('cnh-photos')
        .upload(fileName, buffer, {
          contentType: photo.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Error uploading photo:', uploadError)
        continue
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('cnh-photos')
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) {
        continue
      }

      uploadedUrls.push(urlData.publicUrl)
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload photo(s)' },
        { status: 500 }
      )
    }

    const sessionIdNum = parseInt(sessionId as string, 10)
    await supabaseAdmin
      .from('cnh_session_photos')
      .insert(
        uploadedUrls.map((url) => ({
          session_id: sessionIdNum,
          photo_url: url,
        }))
      )

    const { data: existingSession } = await supabaseAdmin
      .from('cnh_sessions')
      .select('container_photo_url')
      .eq('id', sessionIdNum)
      .single()

    if (!existingSession?.container_photo_url) {
      const { error: updateError } = await supabaseAdmin
        .from('cnh_sessions')
        .update({ container_photo_url: uploadedUrls[0] })
        .eq('id', sessionIdNum)

      if (updateError) {
        console.error('Error updating session:', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      photoUrls: uploadedUrls,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

