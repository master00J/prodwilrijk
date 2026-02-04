import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** POST: Upload photo for storage rental item. Body: formData with itemId, category ('bare'|'verpakt'), photo(s) */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const itemId = formData.get('itemId')
    const category = formData.get('category')
    const photos = formData.getAll('photos') as File[]
    const singlePhoto = formData.get('photo') as File | null
    const allPhotos = photos.length > 0 ? photos : singlePhoto ? [singlePhoto] : []

    if (!itemId || !category || allPhotos.length === 0) {
      return NextResponse.json(
        { error: 'itemId, category en photo(s) zijn verplicht' },
        { status: 400 }
      )
    }

    if (category !== 'bare' && category !== 'verpakt') {
      return NextResponse.json(
        { error: "category moet 'bare' of 'verpakt' zijn" },
        { status: 400 }
      )
    }

    const itemIdNum = parseInt(String(itemId), 10)
    if (isNaN(itemIdNum)) {
      return NextResponse.json({ error: 'Ongeldig itemId' }, { status: 400 })
    }

    const uploadedUrls: string[] = []
    for (const photo of allPhotos) {
      const arrayBuffer = await photo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileExt = photo.name.split('.').pop() || 'jpg'
      const fileName = `item-${itemIdNum}/${category}/${timestamp}_${randomStr}.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('opslag-verhuur-photos')
        .upload(fileName, buffer, { contentType: photo.type, upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('opslag-verhuur-photos')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl)
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
    }

    const { data: item } = await supabaseAdmin
      .from('storage_rental_items')
      .select('photos_bare, photos_verpakt')
      .eq('id', itemIdNum)
      .single()

    const col = category === 'bare' ? 'photos_bare' : 'photos_verpakt'
    const existing = (item?.[col] || []) as string[]
    const updated = [...existing, ...uploadedUrls]

    await supabaseAdmin
      .from('storage_rental_items')
      .update({ [col]: updated })
      .eq('id', itemIdNum)

    return NextResponse.json({ success: true, photoUrls: uploadedUrls, allUrls: updated })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
