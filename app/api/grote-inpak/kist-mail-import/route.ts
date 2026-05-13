import { createHash } from 'crypto'
import tls, { type TLSSocket } from 'tls'
import { NextRequest, NextResponse } from 'next/server'
import { parseKistTePakkenBody, parseKistTePakkenSubject } from '@/lib/grote-inpak/parse-kist-te-pakken-mail'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ImportedKistMail {
  case_label: string
  case_type: string
  item_number: string
  serial_number: string | null
  arrival_date: string | null
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

/** IMAP INTERNALDATE uit FETCH-antwoord (zonder volledige BODY). */
function extractInternalDateFromFetch(response: string): string | null {
  const m = response.match(/INTERNALDATE\s+"([^"]+)"/i)
  return m?.[1]?.trim() || null
}

function parseImapInternalDateToMs(raw: string): number | null {
  const normalized = raw.trim().replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/, (_a, d: string, mon: string, y: string) => `${d} ${mon} ${y}`)
  const t = Date.parse(normalized)
  return Number.isNaN(t) ? null : t
}

function parseBrusselsClockHHmm(s: string): { h: number; m: number } | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

/** Kalenderdag + uur in Europe/Brussels voor een UTC-tijdstempel. */
function brusselsDayAndClockFromMs(ms: number): { dayYmd: string; H: number; M: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms))
  const y = parts.find(p => p.type === 'year')?.value
  const mo = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  const H = Number(parts.find(p => p.type === 'hour')?.value)
  const M = Number(parts.find(p => p.type === 'minute')?.value)
  return { dayYmd: `${y}-${mo}-${d}`, H, M }
}

function internalDateMeetsBrusselsNotBefore(
  internalMs: number,
  filterDayYmd: string,
  minH: number,
  minM: number
): boolean {
  const { dayYmd, H, M } = brusselsDayAndClockFromMs(internalMs)
  if (dayYmd !== filterDayYmd) return false
  return H > minH || (H === minH && M >= minM)
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

function bufferToPlainString(buf: Buffer, charsetRaw: string | undefined): string {
  const c = (charsetRaw || 'utf-8').toLowerCase().replace(/['"]/g, '').split(';')[0].trim()
  if (c === 'utf-8' || c === 'utf8') return buf.toString('utf8')
  return buf.toString('latin1')
}

/** Ruwe HTML → leesbare tekst (alleen voor item/serienummer-patroon in mail zonder text/plain). */
function htmlToRoughPlain(html: string): string {
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
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function collectPlainText(raw: string): string {
  const chunks: string[] = []

  const visit = (partRaw: string) => {
    const { headers, body } = splitHeaderAndBody(partRaw)
    const contentTypeHeader = headers['content-type'] || ''
    const boundary = getBoundary(contentTypeHeader)

    if (boundary) {
      const marker = `--${boundary}`
      for (const segment of body.split(marker).slice(1)) {
        if (segment.startsWith('--')) continue
        visit(segment.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
      }
      return
    }

    if (/text\/plain/i.test(contentTypeHeader)) {
      const buf = decodePartBody(body, headers['content-transfer-encoding'])
      const charsetMatch = contentTypeHeader.match(/charset\s*=\s*"?([^";\s]+)/i)
      chunks.push(bufferToPlainString(buf, charsetMatch?.[1]))
      return
    }

    if (/text\/html/i.test(contentTypeHeader)) {
      const buf = decodePartBody(body, headers['content-transfer-encoding'])
      const charsetMatch = contentTypeHeader.match(/charset\s*=\s*"?([^";\s]+)/i)
      const html = bufferToPlainString(buf, charsetMatch?.[1])
      const plain = htmlToRoughPlain(html)
      if (plain) chunks.push(plain)
    }
  }

  visit(raw)
  return chunks.join('\n\n')
}

function getMessageDedupeKey(headers: Record<string, string>, raw: string): string {
  const mid = (headers['message-id'] || '').trim()
  if (mid) return mid
  return `no-mid:${createHash('sha256').update(raw.slice(0, 16_000)).digest('hex')}`
}

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.GROTE_INPAK_KIST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-grote-inpak-kist-import-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return bearer === secret || headerSecret === secret || querySecret === secret
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

/** Kalenderdag in Brussel, `daysAgo` terug (0 = vandaag). */
function getBelgiumDateDaysAgo(daysAgo: number): string {
  const shifted = new Date(Date.now() - daysAgo * 86400000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted)

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

async function isMessageAlreadyProcessed(messageId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('grote_inpak_kist_mail_processed')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function recordProcessedMessage(messageId: string, caseLabel: string): Promise<void> {
  const { error } = await supabaseAdmin.from('grote_inpak_kist_mail_processed').insert({
    message_id: messageId,
    case_label: caseLabel,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}

async function applyKistMailToCase(row: ImportedKistMail): Promise<{ wasInsert: boolean }> {
  const now = new Date().toISOString()
  const hasSerial = Boolean(row.serial_number?.trim())

  const basePatch = {
    case_type: row.case_type,
    item_number: row.item_number,
    arrival_date: row.arrival_date,
    updated_at: now,
  }

  /** Alleen zetten als de mail een serienummer bevat; anders bestaande DB-waarden laten staan. */
  const serialPatch = hasSerial
    ? {
        serial_number: row.serial_number!.trim(),
        pils_shop_order_key: shopOrderMatchKey(row.serial_number),
      }
    : {}

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('case_label')
    .eq('case_label', row.case_label)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)

  if (existing) {
    const patch = { ...basePatch, ...serialPatch }
    const { error } = await supabaseAdmin.from('grote_inpak_cases').update(patch).eq('case_label', row.case_label)
    if (error) throw new Error(error.message)
    return { wasInsert: false }
  }

  const { error } = await supabaseAdmin.from('grote_inpak_cases').insert({
    case_label: row.case_label,
    ...basePatch,
    serial_number: hasSerial ? row.serial_number!.trim() : null,
    pils_shop_order_key: hasSerial ? shopOrderMatchKey(row.serial_number) : null,
    in_willebroek: false,
    dagen_te_laat: 0,
    dagen_in_willebroek: 0,
    priority: false,
  })
  if (error) throw new Error(error.message)
  return { wasInsert: true }
}

/** Eén rij per kalenderdag (Brussel): telt mails en nieuwe vs bestaande cases. */
async function bumpKistMailDailyLog(
  logDate: string,
  caseLabel: string,
  wasInsert: boolean,
  depth = 0
): Promise<void> {
  if (depth > 5) {
    console.error('kist mail upload log: te veel retries')
    return
  }

  const { data: row, error: selErr } = await supabaseAdmin
    .from('grote_inpak_kist_mail_upload_log')
    .select('mail_count, cases_inserted, cases_updated, case_labels')
    .eq('log_date', logDate)
    .maybeSingle()

  if (selErr) {
    console.error('kist mail upload log select:', selErr.message)
    return
  }

  const ts = new Date().toISOString()
  const label = caseLabel.trim()
  if (!row) {
    const { error } = await supabaseAdmin.from('grote_inpak_kist_mail_upload_log').insert({
      log_date: logDate,
      mail_count: 1,
      cases_inserted: wasInsert ? 1 : 0,
      cases_updated: wasInsert ? 0 : 1,
      case_labels: [label],
      last_event_at: ts,
    })
    if (error?.code === '23505') {
      await bumpKistMailDailyLog(logDate, caseLabel, wasInsert, depth + 1)
      return
    }
    if (error) console.error('kist mail upload log insert:', error.message)
    return
  }

  const prevLabels = Array.isArray(row.case_labels) ? row.case_labels : []
  const case_labels = Array.from(new Set([...prevLabels.map(String), label])).sort()

  const { error } = await supabaseAdmin
    .from('grote_inpak_kist_mail_upload_log')
    .update({
      mail_count: (row.mail_count ?? 0) + 1,
      cases_inserted: (row.cases_inserted ?? 0) + (wasInsert ? 1 : 0),
      cases_updated: (row.cases_updated ?? 0) + (wasInsert ? 0 : 1),
      case_labels,
      last_event_at: ts,
    })
    .eq('log_date', logDate)

  if (error) console.error('kist mail upload log update:', error.message)
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
  // Standaard sinds gisteren (Brussel): IMAP SINCE filtert op berichtdatum; die staat soms vóór “nu”,
  // waardoor “alleen vandaag” een verse mail kan missen. `?sinceDaysAgo=0` = alleen vandaag.
  const rawExplicit = request.nextUrl.searchParams.get('date')
  const rawSince = Number(request.nextUrl.searchParams.get('sinceDaysAgo'))
  const sinceDaysAgo = Number.isFinite(rawSince) ? Math.min(14, Math.max(0, rawSince)) : 1
  const brusselsClock = parseBrusselsClockHHmm(request.nextUrl.searchParams.get('brusselsNotBefore') || '')
  const brusselsFilterDayYmd =
    request.nextUrl.searchParams.get('brusselsFilterDay') || getBelgiumDate()
  // Alleen `brusselsNotBefore` → SINCE die filterdag (meestal vandaag), zodat één URL volstaat voor catch-up.
  const explicitDate = rawExplicit || (brusselsClock ? brusselsFilterDayYmd : null)
  const date = explicitDate || getBelgiumDateDaysAgo(sinceDaysAgo)
  // Standaard géén UNSEEN: mailclients markeren berichten snel als gelezen → dan zou de import ze anders overslaan.
  // Dubbele verwerking voorkomen we met grote_inpak_kist_mail_processed (Message-ID).
  // ?unseenOnly=true of ?includeSeen=false → alleen ongelezen (vroegere default).
  // GROTE_INPAK_KIST_MAIL_UNSEEN_ONLY=true → zelfde, tenzij ?includeSeen=true meegeeft.
  const useUnseenOnly =
    request.nextUrl.searchParams.get('unseenOnly') === 'true' ||
    request.nextUrl.searchParams.get('includeSeen') === 'false' ||
    (process.env.GROTE_INPAK_KIST_MAIL_UNSEEN_ONLY === 'true' &&
      request.nextUrl.searchParams.get('includeSeen') !== 'true')

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail import env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: ImportedKistMail[] = []
  const skipped: Array<{ messageId: string; reason: string }> = []
  const errors: Array<{ messageId: string; error: string }> = []

  try {
    client = await SimpleImapClient.connect(host, port)
    await client.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`, 'LOGIN', 60000)
    await client.command(`SELECT ${imapQuote(mailbox)}`, 'SELECT mailbox')

    const searchQuery = `${useUnseenOnly ? 'UNSEEN ' : ''}SINCE ${toImapDate(date)}`.trim()
    const searchResponse = await client.command(`SEARCH ${searchQuery}`)
    const maxScanBase = Number(process.env.GROTE_INPAK_KIST_MAIL_MAX_SCAN || (brusselsClock ? 300 : 150))
    const maxScan = Math.min(500, Math.max(20, maxScanBase))
    const ids = extractSearchIds(searchResponse)
      .map(id => Number(id))
      .filter(n => !Number.isNaN(n))
      .sort((a, b) => b - a)
      .slice(0, maxScan)
      .map(String)

    for (const id of ids) {
      const refLabel = `imap-${id}`
      try {
        if (brusselsClock) {
          const intResp = await client.command(`FETCH ${id} (INTERNALDATE)`)
          const rawInt = extractInternalDateFromFetch(intResp)
          const internalMs = rawInt ? parseImapInternalDateToMs(rawInt) : null
          if (
            internalMs === null ||
            !internalDateMeetsBrusselsNotBefore(internalMs, brusselsFilterDayYmd, brusselsClock.h, brusselsClock.m)
          ) {
            continue
          }
        }

        const fetchResponse = await client.command(`FETCH ${id} BODY.PEEK[]`)
        const rawMessage = extractFetchBody(fetchResponse)
        if (!rawMessage) {
          errors.push({ messageId: refLabel, error: 'Mail body niet gevonden' })
          continue
        }

        const { headers } = splitHeaderAndBody(rawMessage)
        const dedupeKey = getMessageDedupeKey(headers, rawMessage)

        if (await isMessageAlreadyProcessed(dedupeKey)) {
          skipped.push({ messageId: dedupeKey, reason: 'al_verwerkt' })
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
          continue
        }

        const subject = headers.subject || ''
        const head = parseKistTePakkenSubject(subject)
        if (!head) {
          continue
        }

        const plain = collectPlainText(rawMessage)
        const body = parseKistTePakkenBody(plain)
        if (!body) {
          errors.push({
            messageId: dedupeKey,
            error: 'Kist-mail herkend in onderwerp maar itemnummer niet gevonden in tekst',
          })
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
          continue
        }

        const parsed: ImportedKistMail = { ...head, ...body }
        const { wasInsert } = await applyKistMailToCase(parsed)
        await recordProcessedMessage(dedupeKey, parsed.case_label)
        await bumpKistMailDailyLog(getBelgiumDate(), parsed.case_label, wasInsert)
        imported.push(parsed)
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
      sinceDaysAgo: (rawExplicit || brusselsClock) ? null : sinceDaysAgo,
      brusselsNotBefore: brusselsClock
        ? `${String(brusselsClock.h).padStart(2, '0')}:${String(brusselsClock.m).padStart(2, '0')}`
        : null,
      brusselsFilterDay: brusselsClock ? brusselsFilterDayYmd : null,
      imapSearch: searchQuery,
      unseenOnly: useUnseenOnly,
      checkedMessages: ids.length,
      imported,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Grote Inpak kist-mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
