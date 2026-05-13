import { createHash } from 'crypto'
import tls, { type TLSSocket } from 'tls'

export class SimpleImapClient {
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

export function imapQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function extractSearchIds(response: string): string[] {
  const match = response.match(/^\* SEARCH\s*(.*)$/im)
  if (!match) return []
  return match[1].trim().split(/\s+/).filter(Boolean)
}

export function extractFetchBody(response: string): string | null {
  const match = response.match(/\{(\d+)\}\r\n/)
  if (!match || match.index == null) return null

  const start = match.index + match[0].length
  const length = Number(match[1])
  return response.slice(start, start + length)
}

export function extractInternalDateFromFetch(response: string): string | null {
  const m = response.match(/INTERNALDATE\s+"([^"]+)"/i)
  return m?.[1]?.trim() || null
}

export function parseImapInternalDateToMs(raw: string): number | null {
  const normalized = raw.trim().replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/, (_a, d: string, mon: string, y: string) => `${d} ${mon} ${y}`)
  const t = Date.parse(normalized)
  return Number.isNaN(t) ? null : t
}

export function parseBrusselsClockHHmm(s: string): { h: number; m: number } | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

export function brusselsDayAndClockFromMs(ms: number): { dayYmd: string; H: number; M: number } {
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

export function internalDateMeetsBrusselsNotBefore(
  internalMs: number,
  filterDayYmd: string,
  minH: number,
  minM: number
): boolean {
  const { dayYmd, H, M } = brusselsDayAndClockFromMs(internalMs)
  if (dayYmd !== filterDayYmd) return false
  return H > minH || (H === minH && M >= minM)
}

export function splitHeaderAndBody(raw: string): { headers: Record<string, string>; body: string } {
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

export function getHeaderParam(header: string | undefined, name: string): string | null {
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

export function getBoundary(contentType: string | undefined): string | null {
  return getHeaderParam(contentType, 'boundary')
}

export function decodePartBody(body: string, encoding: string | undefined): Buffer {
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

export function bufferToPlainString(buf: Buffer, charsetRaw: string | undefined): string {
  const c = (charsetRaw || 'utf-8').toLowerCase().replace(/['"]/g, '').split(';')[0].trim()
  if (c === 'utf-8' || c === 'utf8') return buf.toString('utf8')
  return buf.toString('latin1')
}

export function getMessageDedupeKey(headers: Record<string, string>, raw: string): string {
  const mid = (headers['message-id'] || '').trim()
  if (mid) return mid
  return `no-mid:${createHash('sha256').update(raw.slice(0, 16_000)).digest('hex')}`
}

export function getBelgiumDate(): string {
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

export function getBelgiumDateDaysAgo(daysAgo: number): string {
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

export function toImapDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(day).padStart(2, '0')}-${months[month - 1]}-${year}`
}
