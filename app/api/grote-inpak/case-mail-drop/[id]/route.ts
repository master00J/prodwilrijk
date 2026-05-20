import { NextRequest, NextResponse } from 'next/server'
import { resolveMailBodiesFromFile } from '@/lib/grote-inpak/parse-dropped-mail'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_VIEW_HTML = 500_000

function decodeFileBytes(fileBytes: unknown): Buffer {
  if (!fileBytes) return Buffer.alloc(0)
  if (Buffer.isBuffer(fileBytes)) return fileBytes
  if (fileBytes instanceof Uint8Array) return Buffer.from(fileBytes)
  if (typeof fileBytes === 'string') {
    const s = fileBytes
    if (s.startsWith('\\x')) return Buffer.from(s.slice(2), 'hex')
    return Buffer.from(s, 'base64')
  }
  return Buffer.from(fileBytes as ArrayBuffer)
}

function rowToListItem(row: {
  id: number
  case_label: string
  original_filename: string
  subject: string | null
  from_email: string | null
  from_name: string | null
  received_at: string | null
  created_at: string
}) {
  return {
    id: row.id,
    case_label: row.case_label,
    original_filename: row.original_filename,
    subject: row.subject || '(geen onderwerp)',
    from_email: row.from_email,
    from_name: row.from_name,
    received_at: row.received_at,
    created_at: row.created_at,
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params
    const id = Number(idParam)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Ongeldig mail-id' }, { status: 400 })
    }

    const view = request.nextUrl.searchParams.get('view') === '1'
    const download = request.nextUrl.searchParams.get('download') === '1'

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_case_linked_mails')
      .select(
        'id, case_label, original_filename, content_type, subject, from_email, from_name, received_at, created_at, body_text, body_html, file_bytes'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Mail niet gevonden' }, { status: 404 })
    }

    if (download) {
      const bytes = decodeFileBytes(data.file_bytes)
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': data.content_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(data.original_filename || 'mail.msg')}"`,
        },
      })
    }

    if (view) {
      let bodyHtml = data.body_html ? String(data.body_html).slice(0, MAX_VIEW_HTML) : null
      let bodyText = data.body_text ? String(data.body_text) : null

      const fileBuffer = decodeFileBytes(data.file_bytes)
      if (fileBuffer.length > 0 && data.original_filename) {
        const resolved = await resolveMailBodiesFromFile(fileBuffer, data.original_filename, {
          body_text: bodyText,
          body_html: bodyHtml,
        })
        bodyText = resolved.body_text
        bodyHtml = resolved.body_html
          ? resolved.body_html.slice(0, MAX_VIEW_HTML)
          : null

        const shouldPersist =
          (resolved.body_text && resolved.body_text !== data.body_text) ||
          (resolved.body_html && resolved.body_html !== data.body_html)
        if (shouldPersist) {
          await supabaseAdmin
            .from('grote_inpak_case_linked_mails')
            .update({
              body_text: resolved.body_text,
              body_html: resolved.body_html,
            })
            .eq('id', id)
        }
      }

      return NextResponse.json({
        success: true,
        mail: {
          ...rowToListItem(data),
          body_html: bodyHtml,
          body_text: bodyText,
          has_original_file: Boolean(data.file_bytes),
        },
      })
    }

    return NextResponse.json({
      success: true,
      mail: rowToListItem(data),
    })
  } catch (error: unknown) {
    console.error('case-mail-drop GET id:', error)
    const message = error instanceof Error ? error.message : 'Mail ophalen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
