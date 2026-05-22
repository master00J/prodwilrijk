import tls, { type TLSSocket } from 'tls'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  getPackedSourceType,
  parsePackedReviewRows,
  type PackedSourceType,
} from '@/lib/grote-inpak/packed-review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MailAttachment {
  filename: string
  content: Buffer
}

interface ImportedAttachment {
  filename: string
  sourceType: PackedSourceType
  batchId: number
  rows: number
}

interface SkippedAttachment {
  messageId: string
  subject: string | null
  filename: string
  reason: string
}

class SimpleImapClient {
  private socket: TLSSocket
  private buffer = ''
  private tagCounter = 0

  private constructor(socket: TLSSocket) {
    this.socket = socket
    this.socket.setEncoding('utf8')
    this.socket.on('data', chunk => {
      this.buffer += chunk
    })
  }

  static async connect(host: string, port: number): Promise<SimpleImapClient> {
    const socket = tls.connect({ host, port, servername: host })
    const client = new SimpleImapClient(socket)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('IMAP connect timeout')), 15000)
      socket.once('error', reject)
      const check = () => {
        if (/^\* OK/im.test(client.buffer)) {
          clearTimeout(timeout)
          socket.off('data', check)
          socket.off('error', reject)
          resolve()
        }
      }
      socket.on('data', check)
      check()
    })

    return client
  }

  async command(command: string, label = command, timeoutMs = 30000): Promise<string> {
    const tag = `A${++this.tagCounter}`
    const start = this.buffer.length

    this.socket.write(`${tag} ${command}\r\n`)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`IMAP command timeout: ${label}`))
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeout)
        this.socket.off('data', check)
        this.socket.off('error', onError)
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const check = () => {
        const output = this.buffer.slice(start)
        const done = output.match(new RegExp(`(?:^|\\r?\\n)${tag} (OK|NO|BAD)`, 'i'))
        if (!done) return

        cleanup()
        if (done[1].toUpperCase() !== 'OK') {
          reject(new Error(`IMAP command failed: ${label}`))
          return
        }
        resolve(output)
      }

      this.socket.on('data', check)
      this.socket.once('error', onError)
      check()
    })
  }

  async close() {
    try {
      await this.command('LOGOUT')
    } catch {
      this.socket.end()
    }
  }
}

function imapQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function extractSearchIds(response: string): string[] {
  const match = response.match(/^\* SEARCH\s*(.*)$/im)
  if (!match) return []
  return match[1].trim().split(/\s+/).filter(Boolean)
}

function extractFetchBody(response: string): string | null {
  const match = response.match(/\{(\d+)\}\r\n/)
  if (!match || match.index == null) return null

  const start = match.index + match[0].length
  const length = Number(match[1])
  return response.slice(start, start + length)
}

function splitHeaderAndBody(raw: string): { headers: Record<string, string>; body: string } {
  const separator = raw.search(/\r?\n\r?\n/)
  const headerText = separator >= 0 ? raw.slice(0, separator) : raw
  const body = separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, '') : ''
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ')
  const headers: Record<string, string> = {}

  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
  }

  return { headers, body }
}

function getHeaderParam(header: string | undefined, name: string): string | null {
  if (!header) return null

  const encoded = header.match(new RegExp(`${name}\\*=([^;]+)`, 'i'))?.[1]?.trim()
  if (encoded) {
    const value = encoded.replace(/^['"]|['"]$/g, '')
    const parts = value.split("''")
    try {
      return decodeURIComponent(parts.length === 2 ? parts[1] : value)
    } catch {
      return parts.length === 2 ? parts[1] : value
    }
  }

  const plain = header.match(new RegExp(`${name}=("[^"]+"|[^;]+)`, 'i'))?.[1]?.trim()
  return plain ? plain.replace(/^"|"$/g, '') : null
}

function getBoundary(contentType: string | undefined): string | null {
  return getHeaderParam(contentType, 'boundary')
}

function decodePartBody(body: string, encoding: string | undefined): Buffer {
  const normalizedEncoding = (encoding || '').toLowerCase()
  if (normalizedEncoding.includes('base64')) {
    return Buffer.from(body.replace(/\s/g, ''), 'base64')
  }
  if (normalizedEncoding.includes('quoted-printable')) {
    const decoded = body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    return Buffer.from(decoded, 'binary')
  }
  return Buffer.from(body, 'utf8')
}

function collectAttachments(raw: string): MailAttachment[] {
  const attachments: MailAttachment[] = []

  const visit = (partRaw: string) => {
    const { headers, body } = splitHeaderAndBody(partRaw)
    const contentType = headers['content-type']
    const boundary = getBoundary(contentType)

    if (boundary) {
      const marker = `--${boundary}`
      for (const segment of body.split(marker).slice(1)) {
        if (segment.startsWith('--')) continue
        visit(segment.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
      }
      return
    }

    const disposition = headers['content-disposition'] || ''
    const filename =
      getHeaderParam(disposition, 'filename') ||
      getHeaderParam(contentType, 'name')
    const looksLikeExcel =
      Boolean(filename?.match(/\.(xlsx|xls)$/i)) ||
      /spreadsheet|excel|officedocument/i.test(contentType || '')

    if (!filename || !looksLikeExcel) return

    attachments.push({
      filename,
      content: decodePartBody(body, headers['content-transfer-encoding']),
    })
  }

  visit(raw)
  return attachments
}

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.GROTE_INPAK_PACKED_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-grote-inpak-packed-import-secret')

  return bearer === secret || headerSecret === secret
}

function getBelgiumDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

function toImapDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(day).padStart(2, '0')}-${months[month - 1]}-${year}`
}

async function importAttachment(
  attachment: MailAttachment,
  sourceType: PackedSourceType,
  message: { id: string; messageId: string; date: string | null }
): Promise<ImportedAttachment> {
  const rows = parsePackedReviewRows(attachment.content, sourceType)

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('grote_inpak_packed_import_batches')
    .insert({
      source_file: attachment.filename,
      source_type: sourceType,
      mail_message_id: message.messageId,
      mail_date: message.date,
      status: rows.length > 0 ? 'draft' : 'error',
      error_message: rows.length > 0 ? null : 'Geen PACKED regels gevonden',
    })
    .select('id')
    .single()

  if (batchError) throw batchError

  await supabaseAdmin
    .from('grote_inpak_file_uploads')
    .insert({
      file_type: 'packed',
      file_name: attachment.filename,
      file_size: attachment.content.byteLength,
      status: rows.length > 0 ? 'completed' : 'error',
      processed_at: new Date().toISOString(),
      error_message: rows.length > 0 ? null : 'Geen PACKED regels gevonden',
    })

  if (rows.length > 0) {
    const { error: rowsError } = await supabaseAdmin
      .from('grote_inpak_packed_import_rows')
      .insert(rows.map(row => ({
        batch_id: batch.id,
        row_index: row.row_index,
        source_type: row.source_type,
        case_label: row.case_label,
        series: row.series,
        case_type: row.case_type,
        packed_date: row.packed_date,
      })))

    if (rowsError) throw rowsError
  }

  return {
    filename: attachment.filename,
    sourceType,
    batchId: batch.id,
    rows: rows.length,
  }
}

async function importAttachmentGroup(
  entries: Array<{ attachment: MailAttachment; sourceType: PackedSourceType }>,
  message: { id: string; messageId: string; date: string | null }
): Promise<ImportedAttachment> {
  const parsed = entries.flatMap((entry, entryIndex) =>
    parsePackedReviewRows(entry.attachment.content, entry.sourceType).map(row => ({
      ...row,
      row_index: entryIndex * 100000 + (row.row_index || 0),
    }))
  )
  const sourceFile = entries.map(entry => entry.attachment.filename).join(' + ')
  const batchSourceType = entries.some(entry => entry.sourceType === 'packed_n') ? 'packed_n' : entries[0].sourceType

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('grote_inpak_packed_import_batches')
    .insert({
      source_file: sourceFile,
      source_type: batchSourceType,
      mail_message_id: message.messageId,
      mail_date: message.date,
      status: parsed.length > 0 ? 'draft' : 'error',
      error_message: parsed.length > 0 ? null : 'Geen PACKED regels gevonden',
    })
    .select('id')
    .single()

  if (batchError) throw batchError

  for (const entry of entries) {
    await supabaseAdmin
      .from('grote_inpak_file_uploads')
      .insert({
        file_type: 'packed',
        file_name: entry.attachment.filename,
        file_size: entry.attachment.content.byteLength,
        status: parsed.length > 0 ? 'completed' : 'error',
        processed_at: new Date().toISOString(),
        error_message: parsed.length > 0 ? null : 'Geen PACKED regels gevonden',
      })
  }

  if (parsed.length > 0) {
    const { error: rowsError } = await supabaseAdmin
      .from('grote_inpak_packed_import_rows')
      .insert(parsed.map(row => ({
        batch_id: batch.id,
        row_index: row.row_index,
        source_type: row.source_type,
        case_label: row.case_label,
        series: row.series,
        case_type: row.case_type,
        packed_date: row.packed_date,
      })))

    if (rowsError) throw rowsError
  }

  return {
    filename: sourceFile,
    sourceType: batchSourceType,
    batchId: batch.id,
    rows: parsed.length,
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

  const host = process.env.GROTE_INPAK_PACKED_MAIL_HOST || process.env.AIRTEC_MAIL_HOST
  const port = Number(process.env.GROTE_INPAK_PACKED_MAIL_PORT || process.env.AIRTEC_MAIL_PORT || 993)
  const user = process.env.GROTE_INPAK_PACKED_MAIL_USER || process.env.AIRTEC_MAIL_USER
  const password = process.env.GROTE_INPAK_PACKED_MAIL_PASSWORD || process.env.AIRTEC_MAIL_PASSWORD
  const mailbox = process.env.GROTE_INPAK_PACKED_MAILBOX || process.env.AIRTEC_MAILBOX || 'INBOX'
  const date = request.nextUrl.searchParams.get('date') || getBelgiumDate()
  const includeSeen = request.nextUrl.searchParams.get('includeSeen') === 'true'

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail import env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: ImportedAttachment[] = []
  const errors: Array<{ messageId: string; error: string }> = []
  const skipped: SkippedAttachment[] = []

  try {
    client = await SimpleImapClient.connect(host, port)
    await client.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`, 'LOGIN', 60000)
    await client.command(`SELECT ${imapQuote(mailbox)}`, 'SELECT mailbox')

    const searchQuery = `${includeSeen ? '' : 'UNSEEN '}SINCE ${toImapDate(date)}`.trim()
    const searchResponse = await client.command(`SEARCH ${searchQuery}`)
    const ids = extractSearchIds(searchResponse)

    for (const id of ids) {
      try {
        const fetchResponse = await client.command(`FETCH ${id} BODY.PEEK[]`)
        const rawMessage = extractFetchBody(fetchResponse)
        if (!rawMessage) {
          errors.push({ messageId: id, error: 'Mail body niet gevonden' })
          continue
        }

        const { headers } = splitHeaderAndBody(rawMessage)
        const messageId = headers['message-id'] || `imap-${id}`
        const subject = headers.subject || null
        const attachments = collectAttachments(rawMessage)
          .map(attachment => ({
            attachment,
            sourceType: getPackedSourceType(attachment.filename) || getPackedSourceType(subject || ''),
          }))

        attachments
          .filter(entry => !entry.sourceType)
          .forEach(entry => {
            skipped.push({
              messageId,
              subject,
              filename: entry.attachment.filename,
              reason: 'Geen PACKED type gevonden in bijlagenaam of subject',
            })
          })

        const validAttachments = attachments.filter((entry): entry is { attachment: MailAttachment; sourceType: PackedSourceType } => Boolean(entry.sourceType))
        const packedAttachments = validAttachments.filter(entry => entry.sourceType === 'packed')
        const packedNyAttachments = validAttachments.filter(entry => entry.sourceType === 'packed_n' || entry.sourceType === 'packed_y')

        let importedConcept = false
        for (const entry of packedAttachments) {
          const result = await importAttachment(entry.attachment, entry.sourceType, {
            id,
            messageId,
            date: headers.date || null,
          })
          imported.push(result)
          if (result.rows > 0) importedConcept = true
        }

        if (packedNyAttachments.length > 0) {
          const result = await importAttachmentGroup(packedNyAttachments, {
            id,
            messageId,
            date: headers.date || null,
          })
          imported.push(result)
          if (result.rows > 0) importedConcept = true
        }

        if (importedConcept) {
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
        }
      } catch (error) {
        errors.push({
          messageId: id,
          error: error instanceof Error ? error.message : 'Onbekende fout',
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      date,
      checkedMessages: ids.length,
      imported,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Grote Inpak PACKED mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
