import tls, { type TLSSocket } from 'tls'
import { NextRequest, NextResponse } from 'next/server'
import { POST as uploadGroteInpakFile } from '@/app/api/grote-inpak/upload/route'
import { POST as processGroteInpakData } from '@/app/api/grote-inpak/process/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MailAttachment {
  filename: string
  content: Buffer
}

interface ImportedAttachment {
  filename: string
  rows: number
  cases: number
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
    const looksLikeCsv =
      Boolean(filename?.match(/\.csv$/i)) ||
      /(^|\/)(csv|plain)|text\/comma-separated-values/i.test(contentType || '')

    if (!filename || !looksLikeCsv) return

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
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-grote-inpak-pils-import-secret')

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

function getAttachmentPattern(): RegExp {
  const configured = process.env.GROTE_INPAK_PILS_ATTACHMENT_PATTERN
  return configured ? new RegExp(configured, 'i') : /(^|[_\-. ])FOR[_\-. ]?PILS|PILS|\.CSV$/i
}

async function importAttachment(attachment: MailAttachment, sourceFile: string): Promise<ImportedAttachment> {
  const formData = new FormData()
  const file = new Blob([new Uint8Array(attachment.content)], { type: 'text/csv' })
  formData.set('fileType', 'pils')
  formData.append('file', file, attachment.filename)

  const uploadResponse = await uploadGroteInpakFile(new Request(
    'http://internal/api/grote-inpak/upload',
    { method: 'POST', body: formData }
  ) as NextRequest)
  const uploadResult = await uploadResponse.json()
  if (!uploadResponse.ok || !uploadResult.success) {
    throw new Error(uploadResult.error || `PILS upload parsing mislukt voor ${attachment.filename}`)
  }

  const processResponse = await processGroteInpakData(new Request(
    'http://internal/api/grote-inpak/process',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pilsData: uploadResult.data,
        sourceFile,
      }),
    }
  ) as NextRequest)
  const processResult = await processResponse.json()
  if (!processResponse.ok || !processResult.success) {
    throw new Error(processResult.error || `PILS verwerking mislukt voor ${attachment.filename}`)
  }

  return {
    filename: attachment.filename,
    rows: uploadResult.count,
    cases: processResult.count,
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

  const host = process.env.GROTE_INPAK_PILS_MAIL_HOST || process.env.AIRTEC_MAIL_HOST
  const port = Number(process.env.GROTE_INPAK_PILS_MAIL_PORT || process.env.AIRTEC_MAIL_PORT || 993)
  const user = process.env.GROTE_INPAK_PILS_MAIL_USER || process.env.AIRTEC_MAIL_USER
  const password = process.env.GROTE_INPAK_PILS_MAIL_PASSWORD || process.env.AIRTEC_MAIL_PASSWORD
  const mailbox = process.env.GROTE_INPAK_PILS_MAILBOX || 'INBOX'
  const date = request.nextUrl.searchParams.get('date') || getBelgiumDate()
  const includeSeen = request.nextUrl.searchParams.get('includeSeen') === 'true'

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail import env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: ImportedAttachment[] = []
  const errors: Array<{ messageId: string; error: string }> = []
  const attachmentPattern = getAttachmentPattern()

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
        const sourceMessage = headers['message-id'] || headers.date || `imap-${id}`
        const attachments = collectAttachments(rawMessage)
          .filter(attachment => attachmentPattern.test(attachment.filename))

        for (const attachment of attachments) {
          imported.push(await importAttachment(
            attachment,
            `${attachment.filename} via mailbox ${sourceMessage}`
          ))
        }

        if (attachments.length > 0) {
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
      errors,
    })
  } catch (error) {
    console.error('Grote Inpak PILS mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
