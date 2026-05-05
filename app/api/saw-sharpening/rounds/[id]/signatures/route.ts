import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET = 'saw-sharpening-attachments'

const bodySchema = z.object({
  signature_supplier: z.string().min(80).max(6_000_000),
  signature_foresco: z.string().min(80).max(6_000_000),
})

function stripDataUrl(b64: string): string {
  const m = b64.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  return m ? m[2] : b64
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Twee handtekeningen (PNG base64) zijn verplicht.' }, { status: 400 })
    }

    const { data: round, error: fetchErr } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !round) {
      return NextResponse.json({ error: 'Ronde niet gevonden' }, { status: 404 })
    }

    const ts = Date.now()
    const uploads: { field: 'signature_supplier_url' | 'signature_foresco_url'; raw: string }[] = [
      { field: 'signature_supplier_url', raw: stripDataUrl(parsed.data.signature_supplier) },
      { field: 'signature_foresco_url', raw: stripDataUrl(parsed.data.signature_foresco) },
    ]

    const updates: Record<string, string> = {}

    for (const u of uploads) {
      let buffer: Buffer
      try {
        buffer = Buffer.from(u.raw, 'base64')
      } catch {
        return NextResponse.json({ error: 'Ongeldige handtekening (base64)' }, { status: 400 })
      }
      if (!buffer.length) {
        return NextResponse.json({ error: 'Lege handtekening' }, { status: 400 })
      }

      const path = `round-${id}/${u.field}-${ts}.png`
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: 'image/png', upsert: false })

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: 'Handtekening upload mislukt' }, { status: 500 })
      }

      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
      if (!pub?.publicUrl) {
        return NextResponse.json({ error: 'Kon URL niet bepalen' }, { status: 500 })
      }
      updates[u.field] = pub.publicUrl
    }

    const { error: updErr } = await supabaseAdmin
      .from('saw_sharpening_rounds')
      .update(updates)
      .eq('id', id)

    if (updErr) {
      console.error(updErr)
      return NextResponse.json({ error: 'Handtekeningen koppelen mislukt' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...updates })
  } catch (e) {
    console.error('saw-sharpening signatures', e)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
