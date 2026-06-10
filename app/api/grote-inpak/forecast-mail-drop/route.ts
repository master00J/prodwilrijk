import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { parseDroppedMailFile } from '@/lib/grote-inpak/parse-dropped-mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MAIL_BYTES = 15 * 1024 * 1024

function contentTypeForFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.eml')) return 'message/rfc822'
  if (lower.endsWith('.msg')) return 'application/vnd.ms-outlook'
  return 'application/octet-stream'
}

function firstMeaningfulLine(value: string | null | undefined): string | null {
  if (!value) return null
  const line = value
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find(Boolean)
  return line ? line.slice(0, 500) : null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const caseLabel = String(formData.get('case_label') || '').trim()
    const caseType = String(formData.get('case_type') || '').trim() || null
    const file = formData.get('file')

    if (!caseLabel) {
      return NextResponse.json({ error: 'case_label is verplicht' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Sleep een .eml of .msg bestand vanuit Outlook op de forecast-rij.' },
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

    const { data: pilsCase, error: caseError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label')
      .eq('case_label', caseLabel)
      .maybeSingle()

    if (caseError) throw caseError

    const { data: mailRow, error: insertMailError } = await supabaseAdmin
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
      .select('id, case_label, original_filename, subject, from_email, from_name, received_at, created_at')
      .single()

    if (insertMailError) throw insertMailError

    const requestText =
      parsed.subject && parsed.subject !== '(geen onderwerp)'
        ? parsed.subject
        : firstMeaningfulLine(parsed.bodyText || parsed.bodyHtml) || `Mail ontvangen: ${name}`

    const requestedAction = pilsCase
      ? 'Klantvraag opvolgen: unit staat op PILS'
      : 'Klantvraag opvolgen wanneer unit op PILS staat'

    const { data: customerRequest, error: requestError } = await supabaseAdmin
      .from('grote_inpak_customer_requests')
      .insert({
        case_label: caseLabel,
        case_type: caseType,
        customer_name: parsed.fromName || parsed.fromEmail || null,
        request_text: requestText,
        requested_action: requestedAction,
        status: pilsCase ? 'on_pils' : 'waiting_forecast',
        created_from: 'forecast_mail_drop',
        linked_mail_id: mailRow.id,
      })
      .select()
      .single()

    if (requestError) throw requestError

    return NextResponse.json({
      success: true,
      mail: mailRow,
      customer_request: customerRequest,
      summary: `Mail gekoppeld aan ${caseLabel} en klantvraag aangemaakt`,
      parsed: {
        subject: parsed.subject,
        fromEmail: parsed.fromEmail,
        sourceFilename: parsed.sourceFilename,
        mailId: mailRow.id,
      },
    })
  } catch (error: unknown) {
    console.error('forecast-mail-drop:', error)
    const message = error instanceof Error ? error.message : 'Mail koppelen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
