import tls, { type TLSSocket } from 'tls'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { parseAirtecIncomingExcel } from '@/lib/airtec/parse-incoming-excel'
import { fillKnownAirtecKistnummers } from '@/lib/airtec/fill-known-kistnummers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MailAttachment {
  filename: string
  content: Buffer
}

interface ImportedAttachment {
  filename: string
  rows: number
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

  async command(command: string): Promise<string> {
    const tag = `A${++this.tagCounter}`
    const start = this.buffer.length

    this.socket.write(`${tag} ${command}\r\n`)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`IMAP command timeout: ${command}`))
      }, 30000)

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
        const done = output.match(new RegExp(`\\r?\\n${tag} (OK|NO|BAD)`, 'i'))
        if (!done) return

        cleanup()
        if (done[1].toUpperCase() !== 'OK') {
          reject(new Error(`IMAP command failed: ${command}\n${output}`))
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
  const secret = process.env.AIRTEC_MAIL_IMPORT_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-airtec-import-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return bearer === secret || headerSecret === secret || querySecret === secret
}

async function importAttachment(attachment: MailAttachment): Promise<ImportedAttachment> {
  const rows = await fillKnownAirtecKistnummers(parseAirtecIncomingExcel(attachment.content))
  if (rows.length === 0) {
    return { filename: attachment.filename, rows: 0 }
  }

  const { error } = await supabaseAdmin
    .from('incoming_goods_airtec')
    .insert(rows)

  if (error) throw error
  return { filename: attachment.filename, rows: rows.length }
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

  const host = process.env.AIRTEC_MAIL_HOST
  const port = Number(process.env.AIRTEC_MAIL_PORT || 993)
  const user = process.env.AIRTEC_MAIL_USER
  const password = process.env.AIRTEC_MAIL_PASSWORD
  const mailbox = process.env.AIRTEC_MAILBOX || 'INBOX'

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail import env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: ImportedAttachment[] = []
  const errors: Array<{ messageId: string; error: string }> = []

  try {
    client = await SimpleImapClient.connect(host, port)
    await client.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`)
    await client.command(`SELECT ${imapQuote(mailbox)}`)

    const searchResponse = await client.command('SEARCH UNSEEN')
    const ids = extractSearchIds(searchResponse)

    for (const id of ids) {
      try {
        const fetchResponse = await client.command(`FETCH ${id} BODY.PEEK[]`)
        const rawMessage = extractFetchBody(fetchResponse)
        if (!rawMessage) {
          errors.push({ messageId: id, error: 'Mail body niet gevonden' })
          continue
        }

        const attachments = collectAttachments(rawMessage)
          .filter(attachment => /\.(xlsx|xls)$/i.test(attachment.filename))

        for (const attachment of attachments) {
          imported.push(await importAttachment(attachment))
        }

        await client.command(`STORE ${id} +FLAGS (\\Seen)`)
      } catch (error) {
        errors.push({
          messageId: id,
          error: error instanceof Error ? error.message : 'Onbekende fout',
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      checkedMessages: ids.length,
      imported,
      errors,
    })
  } catch (error) {
    console.error('Airtec mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
