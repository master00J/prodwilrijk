/**
 * Parseert "Kist … type … in te pakken"-mails (onderwerp + platte tekst-body).
 */

export interface ParsedKistTePakkenMail {
  case_label: string
  case_type: string
  item_number: string
  /** Ontbreekt vaak in de mail; dan `null`. */
  serial_number: string | null
  /** ISO-datum YYYY-MM-DD */
  arrival_date: string | null
}

/** Onderwerp mag o.a. RE:/FW: (meerdere keren) vooraan hebben. */
const SUBJECT_RE =
  /^(?:(?:RE|FW|AW|VS|ANTWOORD)\s*:\s*)*\s*Kist\s+(\S+)\s+type\s+(.+?)\s+in\s+te\s+pakken\s*$/i

export function parseKistTePakkenSubject(subjectRaw: string): { case_label: string; case_type: string } | null {
  const subject = decodeRfc2047Subject(subjectRaw.trim()).replace(/\s+/g, ' ')
  const m = subject.match(SUBJECT_RE)
  if (!m) return null
  return { case_label: m[1].trim(), case_type: m[2].trim() }
}

export function parseKistTePakkenBody(plainText: string): Omit<ParsedKistTePakkenMail, 'case_label' | 'case_type'> | null {
  const text = plainText.replace(/\r\n/g, '\n')

  const itemM =
    text.match(/Item\s*nummer\s*[:]\s*(\S+)/i) ||
    text.match(/Itemnummer\s*[:]\s*(\S+)/i) ||
    text.match(/Item\s*nr\.?\s*[:]\s*(\S+)/i) ||
    text.match(/Artikel(?:nummer)?\s*[:]\s*(\S+)/i)
  const serialM = text.match(/Serienummer\s*[:]\s*(\S+)/i)
  const datumM = text.match(/Datum\s*[:]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)

  if (!itemM) return null

  const serialRaw = serialM?.[1]?.trim()
  const serial_number = serialRaw ? serialRaw : null

  const arrival_date = datumM ? parseBelgianSlashDate(datumM[1]) : null

  return {
    item_number: itemM[1].trim(),
    serial_number,
    arrival_date,
  }
}

export function parseKistTePakkenMail(
  subjectRaw: string,
  plainText: string
): ParsedKistTePakkenMail | null {
  const head = parseKistTePakkenSubject(subjectRaw)
  if (!head) return null
  const body = parseKistTePakkenBody(plainText)
  if (!body) return null
  return { ...head, ...body }
}

function parseBelgianSlashDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  let y = Number(m[3])
  if (y < 100) y += y >= 70 ? 1900 : 2000
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Minimale RFC 2047 Subject-decode (=?charset?B|Q?…?=). */
function decodeRfc2047Subject(input: string): string {
  return input.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_full, charset: string, enc: string, payload: string) => {
    try {
      if (enc.toUpperCase() === 'B') {
        const buf = Buffer.from(payload.replace(/\s/g, ''), 'base64')
        return decodeBufferWithCharset(buf, String(charset))
      }
      if (enc.toUpperCase() === 'Q') {
        const qp = payload.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        )
        return decodeBufferWithCharset(Buffer.from(qp, 'binary'), String(charset))
      }
    } catch {
      /* fallthrough */
    }
    return payload
  })
}

function decodeBufferWithCharset(buf: Buffer, charset: string): string {
  const c = charset.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (c === 'utf-8' || c === 'utf8') return buf.toString('utf8')
  return buf.toString('latin1')
}
