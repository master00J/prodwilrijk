import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/upload-container-photo - Upload container photo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sessionId = formData.get('sessionId')
    const photo = formData.get('photo') as File

    if (!sessionId || !photo) {
      return NextResponse.json(
        { error: 'sessionId and photo are required' },
        { status: 400 }
      )
    }

    // Upload photo to Supabase Storage
    const arrayBuffer = await photo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExt = photo.name.split('.').pop() || 'jpg'
    const fileName = `cnh-container-photos/${sessionId}/${timestamp}_${randomStr}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('cnh-photos')
      .upload(fileName, buffer, {
        contentType: photo.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading photo:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload photo' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('cnh-photos')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get photo URL' },
        { status: 500 }
      )
    }

    // Update session with photo URL
    const { error: updateError } = await supabaseAdmin
      .from('cnh_sessions')
      .update({ container_photo_url: urlData.publicUrl })
      .eq('id', parseInt(sessionId as string, 10))

    if (updateError) {
      console.error('Error updating session:', updateError)
      // Don't fail the request, photo is uploaded
    }

    return NextResponse.json({
      success: true,
      photoUrl: urlData.publicUrl,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

