import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  labelScanPhotoToIncomingSchema,
  validateBody,
  isErrorResponse,
} from '@/lib/api/validation'

export const dynamic = 'force-dynamic'

const BUCKET = 'airtec-incoming-label-photos'

function extFromMediaType(mt: string): string {
  if (mt === 'image/png') return 'png'
  if (mt === 'image/webp') return 'webp'
  if (mt === 'image/gif') return 'gif'
  return 'jpg'
}

export async function POST(request: Request) {
  try {
    const parsed = await validateBody(request, labelScanPhotoToIncomingSchema)
    if (isErrorResponse(parsed)) return parsed

    const { incomingIds, image, mediaType } = parsed

    let buffer: Buffer
    try {
      buffer = Buffer.from(image, 'base64')
    } catch {
      return NextResponse.json({ error: 'Ongeldige base64-afbeelding' }, { status: 400 })
    }

    if (!buffer.length) {
      return NextResponse.json({ error: 'Lege afbeelding' }, { status: 400 })
    }

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 12)
    const ext = extFromMediaType(mediaType)
    const fileName = `scan-${timestamp}-${randomStr}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: mediaType, upsert: false })

    if (uploadError) {
      console.error('Label scan photo upload:', uploadError)
      return NextResponse.json({ error: 'Upload naar opslag mislukt' }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName)
    const publicUrl = urlData?.publicUrl
    if (!publicUrl) {
      return NextResponse.json({ error: 'Kon geen URL voor foto bepalen' }, { status: 500 })
    }

    const uniqueIds = [...new Set(incomingIds)]

    for (const id of uniqueIds) {
      const { data: row, error: selErr } = await supabaseAdmin
        .from('incoming_goods_airtec')
        .select('label_scan_photo_urls')
        .eq('id', id)
        .maybeSingle()

      if (selErr || !row) {
        console.error('Label scan photo: rij niet gevonden', id, selErr)
        continue
      }

      const current: string[] = Array.isArray(row.label_scan_photo_urls)
        ? row.label_scan_photo_urls
        : []

      const { error: updErr } = await supabaseAdmin
        .from('incoming_goods_airtec')
        .update({ label_scan_photo_urls: [...current, publicUrl] })
        .eq('id', id)

      if (updErr) {
        console.error('Label scan photo: update mislukt', id, updErr)
      }
    }

    return NextResponse.json({ success: true, url: publicUrl, linkedIds: uniqueIds })
  } catch (e) {
    console.error('Label scan photo route:', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
