import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const itemId = formData.get('itemId')
    const itemType = formData.get('itemType')
    const images = formData.getAll('images') as File[]

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Item ID and type are required' },
        { status: 400 }
      )
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    const uploadedUrls: string[] = []

    // Upload each image to Supabase Storage
    for (const image of images) {
      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Generate unique filename
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileExt = image.name.split('.').pop() || 'jpg'
      const fileName = `${itemType}/${itemId}/${timestamp}_${randomStr}.${fileExt}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('item-images')
        .upload(fileName, buffer, {
          contentType: image.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Error uploading to storage:', uploadError)
        continue
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('item-images')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl)

        // Save to item_images table
        await supabaseAdmin
          .from('item_images')
          .insert({
            item_id: parseInt(itemId.toString()),
            item_type: itemType.toString(),
            image_url: urlData.publicUrl,
          })
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload any images' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      uploadedCount: uploadedUrls.length,
      urls: uploadedUrls,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

