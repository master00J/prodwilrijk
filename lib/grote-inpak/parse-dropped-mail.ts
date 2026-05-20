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

function parseEmlBody(raw: string): { bodyText: string | null; bodyHtml: string | null } {
  const split = raw.match(/\r?\n\r?\n/)
  if (!split) return { bodyText: raw.trim() || null, bodyHtml: null }
  const idx = raw.indexOf(split[0])
  const bodyRaw = raw.slice(idx + split[0].length).trim()
  if (!bodyRaw) return { bodyText: null, bodyHtml: null }

  const htmlPart = bodyRaw.match(
    /Content-Type:\s*text\/html[^\r\n]*[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\nContent-Type:|$)/i
  )?.[1]
  const textPart = bodyRaw.match(
    /Content-Type:\s*text\/plain[^\r\n]*[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\nContent-Type:|$)/i
  )?.[1]

  const bodyHtml = htmlPart ? decodeQuotedPrintable(htmlPart).trim() : null
  const bodyText = textPart
    ? decodeQuotedPrintable(textPart).trim()
    : bodyHtml
      ? null
      : decodeQuotedPrintable(bodyRaw).trim()

  return {
    bodyText: bodyText || null,
    bodyHtml: bodyHtml || null,
  }
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

function scrapeMsgBinary(buffer: Buffer, filename: string): ParsedDroppedMail {
  const ascii = buffer.toString('latin1')
  const utf16 = buffer.toString('utf16le')
  const haystack = `${ascii}\n${utf16}`
  const emails = [...haystack.matchAll(/[\w.+-]+@[\w.-]+\.\w+/gi)].map((m) => m[0].toLowerCase())
  const fromEmail = emails.find((e) => !e.includes('microsoft') && !e.endsWith('.png')) || emails[0] || null

  let subject = ''
  const subjMatch = ascii.match(/Subject[\x00-\x20]*([^\x00\r\n]{3,200})/i)
  if (subjMatch) subject = subjMatch[1].replace(/\x00/g, '').trim()

  return {
    fromEmail,
    fromName: null,
    subject: subject || '(geen onderwerp)',
    receivedAt: null,
    sourceFilename: filename,
    bodyText: null,
    bodyHtml: null,
    contentType: 'application/vnd.ms-outlook',
  }
}

async function parseMsgWithReader(buffer: Buffer, filename: string): Promise<ParsedDroppedMail | null> {
  try {
    const mod = await import('@kenjiuno/msgreader')
    const MsgReader = mod.default as new (ab: ArrayBuffer) => {
      getFileData(): {
        subject?: string
        senderName?: string
        senderEmail?: string
        clientSubmitTime?: string
        messageDeliveryTime?: string
        body?: string
        bodyHTML?: string
      }
    }
    const arrayBuffer = new Uint8Array(buffer).buffer
    const reader = new MsgReader(arrayBuffer)
    const data = reader.getFileData()
    const fromEmail = extractEmail(data.senderEmail) || extractEmail(data.senderName)
    let receivedAt: string | null = null
    const dateRaw = data.clientSubmitTime || data.messageDeliveryTime
    if (dateRaw) {
      const d = new Date(dateRaw)
      if (!Number.isNaN(d.getTime())) receivedAt = d.toISOString()
    }
    const bodyHtml = (data.bodyHTML || '').trim() || null
    const bodyText = (data.body || '').trim() || null

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

export async function parseDroppedMailFile(
  buffer: Buffer,
  filename: string
): Promise<ParsedDroppedMail> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.eml')) {
    return parseEmlFull(buffer.toString('utf8'), filename)
  }
  if (lower.endsWith('.msg')) {
    return (await parseMsgWithReader(buffer, filename)) || scrapeMsgBinary(buffer, filename)
  }
  throw new Error('Alleen .eml of .msg bestanden vanuit Outlook worden ondersteund.')
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
