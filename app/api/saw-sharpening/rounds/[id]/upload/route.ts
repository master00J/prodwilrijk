import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET = 'saw-sharpening-attachments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

    const { data: round, error: fetchErr } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .select('photo_urls')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !round) {
      return NextResponse.json({ error: 'Ronde niet gevonden' }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll('photos') as File[]
    const single = formData.get('photo') as File | null
    const allFiles = files.length > 0 ? files : single ? [single] : []

    if (allFiles.length === 0) {
      return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    }

    const current: string[] = Array.isArray(round.photo_urls) ? round.photo_urls : []
    const uploaded: string[] = []
    const ts = Date.now()

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i]
      if (!file.size) continue
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
      const path = `round-${id}/photo-${ts}-${i}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`

      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: false })

      if (upErr) {
        console.error(upErr)
        continue
      }

      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
      if (pub?.publicUrl) uploaded.push(pub.publicUrl)
    }

    if (uploaded.length === 0) {
      return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
    }

    const merged = [...current, ...uploaded]
    const { error: updErr } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .update({ photo_urls: merged })
      .eq('id', id)

    if (updErr) {
      console.error(updErr)
      return NextResponse.json({ error: 'URL’s opslaan mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true, uploadedUrls: uploaded, photo_urls: merged })
  } catch (e) {
    console.error('saw-sharpening upload', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
