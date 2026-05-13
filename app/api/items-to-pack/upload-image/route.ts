import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES_PER_UPLOAD = 10
const ALLOWED_ITEM_TYPES = new Set([
  'items_to_pack',
  'items_to_pack_airtec',
  'returned_items',
  'wms_project',
  'wms_package',
  'wms_project_line',
])
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

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

    const itemIdNumber = Number(itemId)
    const itemTypeValue = itemType.toString()

    if (!Number.isInteger(itemIdNumber) || itemIdNumber <= 0) {
      return NextResponse.json(
        { error: 'Invalid item ID' },
        { status: 400 }
      )
    }

    if (!ALLOWED_ITEM_TYPES.has(itemTypeValue)) {
      return NextResponse.json(
        { error: 'Invalid item type' },
        { status: 400 }
      )
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    if (images.length > MAX_IMAGES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Maximaal ${MAX_IMAGES_PER_UPLOAD} afbeeldingen per upload` },
        { status: 400 }
      )
    }

    const uploadedUrls: string[] = []

    // Upload each image to Supabase Storage
    for (const image of images) {
      const fileExt = ALLOWED_IMAGE_TYPES[image.type]
      if (!fileExt) {
        return NextResponse.json(
          { error: 'Ongeldig afbeeldingsformaat' },
          { status: 400 }
        )
      }

      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'Afbeelding te groot (max 5MB)' },
          { status: 400 }
        )
      }

      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Generate unique filename
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileName = `${itemTypeValue}/${itemIdNumber}/${timestamp}_${randomStr}.${fileExt}`

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
            item_id: itemIdNumber,
            item_type: itemTypeValue,
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





