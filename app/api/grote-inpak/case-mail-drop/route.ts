import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  buildMailLinkComment,
  parseDroppedMailFile,
} from '@/lib/grote-inpak/parse-dropped-mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MAIL_BYTES = 15 * 1024 * 1024

function contentTypeForFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.eml')) return 'message/rfc822'
  if (lower.endsWith('.msg')) return 'application/vnd.ms-outlook'
  return 'application/octet-stream'
}

export async function GET(request: NextRequest) {
  try {
    const caseLabel = request.nextUrl.searchParams.get('case_label')?.trim()
    if (!caseLabel) {
      return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_case_linked_mails')
      .select(
        'id, case_label, original_filename, subject, from_email, from_name, received_at, created_at'
      )
      .eq('case_label', caseLabel)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      case_label: caseLabel,
      mails: data || [],
      count: data?.length || 0,
    })
  } catch (error: unknown) {
    console.error('case-mail-drop GET list:', error)
    const message = error instanceof Error ? error.message : 'Mails ophalen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const caseLabel = String(formData.get('case_label') || '').trim()
    const file = formData.get('file')

    if (!caseLabel) {
      return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Sleep een .eml of .msg bestand vanuit Outlook op de rij.' },
        { status: 400 }
      )
    }

    const name = file.name || 'mail.msg'
    const lower = name.toLowerCase()
    if (!lower.endsWith('.eml') && !lower.endsWith('.msg')) {
      return NextResponse.json(
        { error: 'Alleen Outlook .eml of .msg bestanden worden ondersteund.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_MAIL_BYTES) {
      return NextResponse.json(
        { error: 'Mailbestand is te groot (max. 15 MB).' },
        { status: 400 }
      )
    }

    const parsed = await parseDroppedMailFile(buffer, name)

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, atlas_planner_email, comment')
      .eq('case_label', caseLabel)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      return NextResponse.json(
        { error: `Caselabel ${caseLabel} niet gevonden in PILS-overzicht` },
        { status: 404 }
      )
    }

    const { data: mailRow, error: insertError } = await supabaseAdmin
      .from('grote_inpak_case_linked_mails')
      .insert({
        case_label: caseLabel,
        original_filename: name,
        content_type: parsed.contentType || contentTypeForFilename(name),
        file_bytes: buffer,
        subject: parsed.subject,
        from_email: parsed.fromEmail,
        from_name: parsed.fromName,
        received_at: parsed.receivedAt,
        body_text: parsed.bodyText,
        body_html: parsed.bodyHtml,
      })
      .select('id, case_label, original_filename, subject, from_email, received_at, created_at')
      .single()

    if (insertError) throw insertError

    const atlas_planner_email = parsed.fromEmail || existing.atlas_planner_email || null
    const comment = buildMailLinkComment(parsed, existing.comment, mailRow.id)

    const { data, error: updateError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .update({ atlas_planner_email, comment })
      .eq('case_label', caseLabel)
      .select('case_label, atlas_planner_email, comment')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      data,
      mail: mailRow,
      summary: `Mail gekoppeld aan ${caseLabel}${atlas_planner_email ? ` (${atlas_planner_email})` : ''}`,
      parsed: {
        subject: parsed.subject,
        fromEmail: parsed.fromEmail,
        sourceFilename: parsed.sourceFilename,
        mailId: mailRow.id,
      },
    })
  } catch (error: unknown) {
    console.error('case-mail-drop:', error)
    const message = error instanceof Error ? error.message : 'Mail koppelen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
