export type ParsedDroppedMail = {
  fromEmail: string | null
  fromName: string | null
  subject: string
  receivedAt: string | null
  sourceFilename: string
  bodyText: string | null
  bodyHtml: string | null
  contentType: string
}

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w+/i

function extractEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const match = String(value).match(EMAIL_RE)
  return match ? match[0].toLowerCase() : null
}

function decodeMimeHeader(value: string): string {
  const trimmed = value.trim()
  const encoded = trimmed.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi)
  if (!encoded) return trimmed.replace(/\s+/g, ' ').trim()

  return trimmed
    .replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, _charset, encoding, payload) => {
      try {
        if (String(encoding).toUpperCase() === 'B') {
          return Buffer.from(payload, 'base64').toString('utf8')
        }
        return payload
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          )
      } catch {
        return payload
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function decodeBase64Body(input: string): string {
  try {
    return Buffer.from(input.replace(/\s+/g, ''), 'base64').toString('utf8')
  } catch {
    return input
  }
}

function parseMimeParts(raw: string): { bodyText: string | null; bodyHtml: string | null } {
  const htmlPart = raw.match(
    /Content-Type:\s*text\/html[^\r\n]*(?:[\s\S]*?\r?\n(?![\t ]))([\s\S]*?)\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|\r?\nContent-Type:|$)/i
  )
  const textPart = raw.match(
    /Content-Type:\s*text\/plain[^\r\n]*(?:[\s\S]*?\r?\n(?![\t ]))([\s\S]*?)\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|\r?\nContent-Type:|$)/i
  )

  const decodePart = (match: RegExpMatchArray | null) => {
    if (!match) return null
    const headers = match[1] || ''
    let body = (match[2] || '').trim()
    if (!body) return null
    if (/Content-Transfer-Encoding:\s*base64/i.test(headers)) {
      body = decodeBase64Body(body)
    } else if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(headers)) {
      body = decodeQuotedPrintable(body)
    }
    return body.trim() || null
  }

  const bodyHtml = decodePart(htmlPart)
  const bodyText = decodePart(textPart)

  return { bodyText, bodyHtml }
}

function parseEmlBody(raw: string): { bodyText: string | null; bodyHtml: string | null } {
  const split = raw.match(/\r?\n\r?\n/)
  if (!split) return { bodyText: raw.trim() || null, bodyHtml: null }
  const idx = raw.indexOf(split[0])
  const bodyRaw = raw.slice(idx + split[0].length).trim()
  if (!bodyRaw) return { bodyText: null, bodyHtml: null }

  const fromMime = parseMimeParts(bodyRaw)
  if (fromMime.bodyHtml || fromMime.bodyText) return fromMime

  const bodyText = decodeQuotedPrintable(bodyRaw).trim()
  return { bodyText: bodyText || null, bodyHtml: null }
}

function parseEmlFull(raw: string, filename: string): ParsedDroppedMail {
  const headerBlock = raw.split(/\r?\n\r?\n/)[0] || raw
  const unfold = headerBlock.replace(/\r?\n[ \t]+/g, ' ')
  const fromLine =
    unfold.match(/^From:\s*(.+)$/im)?.[1] ||
    unfold.match(/^Reply-To:\s*(.+)$/im)?.[1] ||
    ''
  const subject = decodeMimeHeader(unfold.match(/^Subject:\s*(.+)$/im)?.[1] || '')
  const dateRaw = unfold.match(/^Date:\s*(.+)$/im)?.[1]?.trim() || null
  const fromEmail = extractEmail(fromLine) || extractEmail(raw.slice(0, 8000))
  const fromName = fromLine.replace(/<[^>]+>/g, '').replace(EMAIL_RE, '').replace(/"/g, '').trim() || null

  let receivedAt: string | null = null
  if (dateRaw) {
    const d = new Date(dateRaw)
    if (!Number.isNaN(d.getTime())) receivedAt = d.toISOString()
  }

  const { bodyText, bodyHtml } = parseEmlBody(raw)

  return {
    fromEmail,
    fromName,
    subject: subject || '(geen onderwerp)',
    receivedAt,
    sourceFilename: filename,
    bodyText,
    bodyHtml,
    contentType: 'message/rfc822',
  }
}

function pickNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = (v || '').trim()
    if (t.length > 0) return t
  }
  return null
}

function isMeaningfulBodyText(value: string | null | undefined): boolean {
  if (!value) return false
  const stripped = value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > 0
}

function rtfToPlainText(rtf: string): string {
  let text = rtf
    .replace(/\\par[d]?\b/gi, '\n')
    .replace(/\\line\b/gi, '\n')
    .replace(/\\tab\b/gi, '\t')
    .replace(/\\'[0-9a-f]{2}/gi, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => {
      const code = Number(n)
      return code >= 0 ? String.fromCharCode(code) : ''
    })
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return text
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (Buffer.isBuffer(value)) return new Uint8Array(value)
  if (Array.isArray(value)) return Uint8Array.from(value)
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.startsWith('\\x')) return Uint8Array.from(Buffer.from(s.slice(2), 'hex'))
    if (/^[0-9a-f]+$/i.test(s) && s.length % 2 === 0) {
      return Uint8Array.from(Buffer.from(s, 'hex'))
    }
    try {
      return Uint8Array.from(Buffer.from(s, 'base64'))
    } catch {
      return null
    }
  }
  return null
}

async function bodyFromCompressedRtf(compressed: unknown): Promise<string | null> {
  const bytes = toUint8Array(compressed)
  if (!bytes || bytes.length === 0) return null
  try {
    const { decompressRTF } = await import('@kenjiuno/decompressrtf')
    const decompressed = decompressRTF(bytes)
    const rtf = Buffer.from(decompressed).toString('latin1')
    const plain = rtfToPlainText(rtf)
    return plain.trim() || null
  } catch {
    return null
  }
}

function toMsgArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function scrapeMsgBodyFromBinary(buffer: Buffer): { bodyText: string | null; bodyHtml: string | null } {
  const runs: string[] = []
  let current = ''

  const pushCurrent = () => {
    const trimmed = current.replace(/\0/g, '').trim()
    if (trimmed.length >= 40) runs.push(trimmed)
    current = ''
  }

  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const code = buffer.readUInt16LE(i)
    const isPrintable =
      code === 0x0009 ||
      code === 0x000a ||
      code === 0x000d ||
      (code >= 0x0020 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)

    if (isPrintable) {
      if (code === 0x0009) current += '\t'
      else if (code === 0x000a || code === 0x000d) current += '\n'
      else current += String.fromCharCode(code)
    } else {
      pushCurrent()
    }
  }
  pushCurrent()

  const filtered = runs
    .filter((run) => {
      if (/^[\x00-\x1f\s]+$/.test(run)) return false
      if (/^(Microsoft|Exchange|Outlook|MAPI|SMTP|Content-Type|Message-ID)/i.test(run)) return false
      if (/^[A-Za-z0-9_\-./\\:]+\.(msg|dll|exe|png|jpg)$/i.test(run)) return false
      const words = run.split(/\s+/).filter(Boolean)
      return words.length >= 4
    })
    .sort((a, b) => b.length - a.length)

  const best = filtered[0] || null
  return { bodyText: best, bodyHtml: null }
}

function scrapeMsgBinary(buffer: Buffer, filename: string): ParsedDroppedMail {
  const ascii = buffer.toString('latin1')
  const emails = [...ascii.matchAll(/[\w.+-]+@[\w.-]+\.\w+/gi)].map((m) => m[0].toLowerCase())
  const fromEmail = emails.find((e) => !e.includes('microsoft') && !e.endsWith('.png')) || emails[0] || null

  let subject = ''
  const subjMatch = ascii.match(/Subject[\x00-\x20]*([^\x00\r\n]{3,200})/i)
  if (subjMatch) subject = subjMatch[1].replace(/\x00/g, '').trim()

  const scraped = scrapeMsgBodyFromBinary(buffer)

  return {
    fromEmail,
    fromName: null,
    subject: subject || '(geen onderwerp)',
    receivedAt: null,
    sourceFilename: filename,
    bodyText: scraped.bodyText,
    bodyHtml: scraped.bodyHtml,
    contentType: 'application/vnd.ms-outlook',
  }
}

type MsgFields = {
  error?: string
  subject?: string
  senderName?: string
  senderEmail?: string
  clientSubmitTime?: string
  messageDeliveryTime?: string
  body?: string
  bodyHtml?: string
  bodyHTML?: string
  html?: string
  contactHtml?: string
  headers?: string
  compressedRtf?: unknown
  innerMsgContentFields?: MsgFields
}

async function bodiesFromMsgFields(data: MsgFields): Promise<{ bodyText: string | null; bodyHtml: string | null }> {
  let bodyHtml = pickNonEmpty(data.bodyHtml, data.bodyHTML, data.html, data.contactHtml)
  let bodyText = pickNonEmpty(data.body)

  if (data.headers) {
    const fromHeaders = parseEmlBody(String(data.headers))
    bodyHtml = bodyHtml || fromHeaders.bodyHtml
    bodyText = bodyText || fromHeaders.bodyText
  }

  if (data.innerMsgContentFields) {
    const inner = await bodiesFromMsgFields(data.innerMsgContentFields)
    bodyHtml = bodyHtml || inner.bodyHtml
    bodyText = bodyText || inner.bodyText
  }

  if (!isMeaningfulBodyText(bodyHtml) && !isMeaningfulBodyText(bodyText)) {
    const fromRtf = await bodyFromCompressedRtf(data.compressedRtf)
    if (fromRtf) bodyText = fromRtf
  }

  if (bodyHtml && !isMeaningfulBodyText(bodyHtml)) bodyHtml = null
  if (bodyText && !isMeaningfulBodyText(bodyText)) bodyText = null

  return { bodyText, bodyHtml }
}

async function parseMsgWithReader(buffer: Buffer, filename: string): Promise<ParsedDroppedMail | null> {
  try {
    const mod = await import('@kenjiuno/msgreader')
    const MsgReader = mod.default as new (input: ArrayBuffer | Buffer) => {
      getFileData(): MsgFields
    }
    const reader = new MsgReader(toMsgArrayBuffer(buffer))
    const data = reader.getFileData()
    if (!data || data.error) return null

    const fromEmail = extractEmail(data.senderEmail) || extractEmail(data.senderName)
    let receivedAt: string | null = null
    const dateRaw = data.clientSubmitTime || data.messageDeliveryTime
    if (dateRaw) {
      const d = new Date(dateRaw)
      if (!Number.isNaN(d.getTime())) receivedAt = d.toISOString()
    }

    const { bodyText, bodyHtml } = await bodiesFromMsgFields(data)

    return {
      fromEmail,
      fromName: data.senderName?.trim() || null,
      subject: (data.subject || '').trim() || '(geen onderwerp)',
      receivedAt,
      sourceFilename: filename,
      bodyText,
      bodyHtml,
      contentType: 'application/vnd.ms-outlook',
    }
  } catch {
    return null
  }
}

async function parseMsgFile(buffer: Buffer, filename: string): Promise<ParsedDroppedMail> {
  const parsed = await parseMsgWithReader(buffer, filename)
  if (parsed && (isMeaningfulBodyText(parsed.bodyHtml) || isMeaningfulBodyText(parsed.bodyText))) {
    return parsed
  }

  const scraped = scrapeMsgBinary(buffer, filename)
  if (parsed) {
    return {
      ...parsed,
      bodyText: parsed.bodyText || scraped.bodyText,
      bodyHtml: parsed.bodyHtml || scraped.bodyHtml,
    }
  }
  return scraped
}

/** Herparseer opgeslagen bestand; file heeft altijd voorrang op lege DB-body. */
export async function resolveMailBodiesFromFile(
  buffer: Buffer,
  filename: string,
  stored: { body_text: string | null; body_html: string | null }
): Promise<{ body_text: string | null; body_html: string | null }> {
  let parsed: ParsedDroppedMail | null = null
  try {
    parsed = await parseDroppedMailFile(buffer, filename)
  } catch {
    parsed = null
  }

  const body_text = pickNonEmpty(parsed?.bodyText, stored.body_text)
  const body_html = pickNonEmpty(parsed?.bodyHtml, stored.body_html)

  return {
    body_text: isMeaningfulBodyText(body_text) ? body_text : null,
    body_html: isMeaningfulBodyText(body_html) ? body_html : null,
  }
}

export async function parseDroppedMailFile(
  buffer: Buffer,
  filename: string
): Promise<ParsedDroppedMail> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.eml')) {
    return parseEmlFull(buffer.toString('utf8'), filename)
  }
  if (lower.endsWith('.msg')) {
    return parseMsgFile(buffer, filename)
  }
  throw new Error('Alleen .eml of .msg bestanden van Outlook worden ondersteund.')
}

export function buildMailLinkComment(
  parsed: ParsedDroppedMail,
  existingComment: string | null | undefined,
  mailId?: number
): string {
  const when = parsed.receivedAt
    ? new Date(parsed.receivedAt).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })
    : 'onbekend tijdstip'
  const from = parsed.fromEmail || parsed.fromName || 'onbekende afzender'
  const idPart = mailId ? `#${mailId} ` : ''
  const line = `[Mail ${idPart}${when}] ${parsed.subject} — ${from} (${parsed.sourceFilename})`
  const base = (existingComment || '').trim()
  if (!base) return line
  if (base.includes(parsed.sourceFilename) || base.includes(parsed.subject)) return base
  return `${base}\n${line}`
}
