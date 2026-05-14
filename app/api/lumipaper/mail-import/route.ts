import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  SimpleImapClient,
  imapQuote,
  extractSearchIds,
  extractFetchBody,
  splitHeaderAndBody,
  getBoundary,
  decodePartBody,
  bufferToPlainString,
  getMessageDedupeKey,
  getBelgiumDateDaysAgo,
  toImapDate,
} from '@/lib/grote-inpak/imap-mail-core'
import { generateLumipaperImport, type LumipaperGeneratedFile } from '@/lib/lumipaper/configurator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.LUMIPAPER_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_FORECAST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_KIST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-lumipaper-import-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return bearer === secret || headerSecret === secret || querySecret === secret
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function collectPlainText(raw: string): string {
  const chunks: string[] = []

  const visit = (partRaw: string) => {
    const { headers, body } = splitHeaderAndBody(partRaw)
    const contentType = headers['content-type'] || ''
    const boundary = getBoundary(contentType)

    if (boundary) {
      const marker = `--${boundary}`
      for (const segment of body.split(marker).slice(1)) {
        if (segment.startsWith('--')) continue
        visit(segment.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
      }
      return
    }

    if (/text\/plain/i.test(contentType) || (!contentType && body)) {
      const buf = decodePartBody(body, headers['content-transfer-encoding'])
      const charsetMatch = contentType.match(/charset\s*=\s*"?([^";\s]+)/i)
      chunks.push(bufferToPlainString(buf, charsetMatch?.[1]))
      return
    }

    if (/text\/html/i.test(contentType)) {
      const buf = decodePartBody(body, headers['content-transfer-encoding'])
      const charsetMatch = contentType.match(/charset\s*=\s*"?([^";\s]+)/i)
      chunks.push(htmlToPlain(bufferToPlainString(buf, charsetMatch?.[1])))
    }
  }

  visit(raw)
  return chunks.join('\n\n')
}

function stripFileContent(files: LumipaperGeneratedFile[]) {
  return files.map(({ base64, ...file }) => ({
    ...file,
    sizeBytes: Buffer.byteLength(base64, 'base64'),
  }))
}

function isLumipaperOrderSubject(subject: string): boolean {
  return /bestelbon/i.test(subject) && /lumipaper/i.test(subject)
}

async function alreadyProcessed(messageId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function saveMailImport(params: {
  messageId: string
  subject: string
  sourceEmail: string | null
  rawText: string
}) {
  const result = await generateLumipaperImport(params.rawText)
  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .insert({
      message_id: params.messageId,
      order_number: result.orderNumber,
      subject: params.subject,
      source_email: params.sourceEmail,
      source_file: 'mailbox',
      total_lines: result.totalLines,
      generated_files: result.generatedFiles,
      parsed_lines: result.lines,
      unmapped_lines: result.unmapped,
      status: result.unmapped.length > 0 ? 'partial' : 'processed',
      created_by: 'mail-import',
    })
    .select('id, order_number, subject, source_email, total_lines, generated_files, status, created_at')
    .single()

  if (error) throw new Error(error.message)

  return {
    ...data,
    generated_files: stripFileContent((data.generated_files || []) as LumipaperGeneratedFile[]),
  }
}

export async function GET(request: NextRequest) {
  return runImport(request)
}

export async function POST(request: NextRequest) {
  return runImport(request)
}

async function runImport(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 })
  }

  const host =
    process.env.LUMIPAPER_MAIL_HOST ||
    process.env.GROTE_INPAK_PILS_MAIL_HOST ||
    process.env.AIRTEC_MAIL_HOST
  const port = Number(
    process.env.LUMIPAPER_MAIL_PORT ||
    process.env.GROTE_INPAK_PILS_MAIL_PORT ||
    process.env.AIRTEC_MAIL_PORT ||
    993
  )
  const user =
    process.env.LUMIPAPER_MAIL_USER ||
    process.env.GROTE_INPAK_PILS_MAIL_USER ||
    process.env.AIRTEC_MAIL_USER
  const password =
    process.env.LUMIPAPER_MAIL_PASSWORD ||
    process.env.GROTE_INPAK_PILS_MAIL_PASSWORD ||
    process.env.AIRTEC_MAIL_PASSWORD
  const mailbox =
    process.env.LUMIPAPER_MAILBOX ||
    process.env.GROTE_INPAK_PILS_MAILBOX ||
    process.env.AIRTEC_MAILBOX ||
    'INBOX'
  const rawSince = Number(request.nextUrl.searchParams.get('sinceDaysAgo'))
  const sinceDaysAgo = Number.isFinite(rawSince) ? Math.min(14, Math.max(0, rawSince)) : 2
  const date = request.nextUrl.searchParams.get('date') || getBelgiumDateDaysAgo(sinceDaysAgo)
  const useUnseenOnly = request.nextUrl.searchParams.get('unseenOnly') === 'true'

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: any[] = []
  const skipped: Array<{ messageId: string; reason: string }> = []
  const errors: Array<{ messageId: string; error: string }> = []

  try {
    client = await SimpleImapClient.connect(host, port)
    await client.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`, 'LOGIN', 60000)
    await client.command(`SELECT ${imapQuote(mailbox)}`, 'SELECT mailbox')

    const searchQuery = `${useUnseenOnly ? 'UNSEEN ' : ''}SINCE ${toImapDate(date)}`.trim()
    const searchResponse = await client.command(`SEARCH ${searchQuery}`)
    const ids = extractSearchIds(searchResponse)
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => b - a)
      .slice(0, 100)
      .map(String)

    for (const id of ids) {
      const refLabel = `imap-${id}`
      try {
        const fetchResponse = await client.command(`FETCH ${id} BODY.PEEK[]`)
        const rawMessage = extractFetchBody(fetchResponse)
        if (!rawMessage) {
          errors.push({ messageId: refLabel, error: 'Mail body niet gevonden' })
          continue
        }

        const { headers } = splitHeaderAndBody(rawMessage)
        const subject = headers.subject || ''
        if (!isLumipaperOrderSubject(subject)) continue

        const dedupeKey = getMessageDedupeKey(headers, rawMessage)
        if (await alreadyProcessed(dedupeKey)) {
          skipped.push({ messageId: dedupeKey, reason: 'al_verwerkt' })
          continue
        }

        const plain = collectPlainText(rawMessage)
        const saved = await saveMailImport({
          messageId: dedupeKey,
          subject,
          sourceEmail: headers.from || null,
          rawText: plain || rawMessage,
        })

        imported.push(saved)
        await client.command(`STORE ${id} +FLAGS (\\Seen)`)
      } catch (error) {
        errors.push({
          messageId: refLabel,
          error: error instanceof Error ? error.message : 'Onbekende fout',
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      date,
      imapSearch: searchQuery,
      checkedMessages: ids.length,
      imported,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Lumipaper mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lumipaper mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
