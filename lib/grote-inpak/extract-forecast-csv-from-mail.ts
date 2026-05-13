import {
  splitHeaderAndBody,
  getBoundary,
  decodePartBody,
  getHeaderParam,
} from '@/lib/grote-inpak/imap-mail-core'

function decodeBufferWithCharset(buf: Buffer, charset: string): string {
  const c = charset.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (c === 'utf-8' || c === 'utf8') return buf.toString('utf8')
  return buf.toString('latin1')
}

/** Minimale RFC 2047 in willekeurige headerwaarde (onderwerp / bestandsnaam). */
export function decodeMimeWords(input: string): string {
  return input.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_full, charset: string, enc: string, payload: string) => {
    try {
      if (enc.toUpperCase() === 'B') {
        const buf = Buffer.from(String(payload).replace(/\s/g, ''), 'base64')
        return decodeBufferWithCharset(buf, String(charset))
      }
      if (enc.toUpperCase() === 'Q') {
        const qp = String(payload)
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        return decodeBufferWithCharset(Buffer.from(qp, 'binary'), String(charset))
      }
    } catch {
      /* fallthrough */
    }
    return payload
  })
}

export interface ForecastCsvAttachment {
  filename: string
  csvText: string
}

function basenameLower(p: string): string {
  return p.replace(/^.*[/\\]/, '').trim().toLowerCase()
}

function partFilename(headers: Record<string, string>): string {
  const cd = headers['content-disposition'] || ''
  let raw = ''
  const fnStar = cd.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i)?.[1]
  if (fnStar) {
    try {
      return decodeMimeWords(decodeURIComponent(fnStar))
    } catch {
      raw = fnStar
    }
  }
  if (!raw) {
    const fnQ = cd.match(/filename="([^"]+)"/i)?.[1] || cd.match(/filename=([^;\s]+)/i)?.[1]
    if (fnQ) raw = fnQ.replace(/^["']|["']$/g, '')
  }
  const ct = headers['content-type'] || ''
  const fromParam =
    getHeaderParam(ct, 'name') ||
    ct.match(/name="([^"]+)"/i)?.[1]?.trim() ||
    ct.match(/name=([^;\s]+)/i)?.[1]?.trim() ||
    ''
  const pick = raw || fromParam
  return decodeMimeWords(pick.replace(/^["']|["']$/g, '')).trim()
}

function csvBytesToString(buf: Buffer): string {
  return buf.toString('latin1')
}

/** Alle MIME-onderdelen die als forecast-CSV gelden (.csv-naam of text/csv). */
export function extractForecastCsvAttachmentsFromRawMessage(raw: string): ForecastCsvAttachment[] {
  const out: ForecastCsvAttachment[] = []

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

    const lowerCt = contentTypeHeader.toLowerCase()
    const fn = partFilename(headers)
    const base = basenameLower(fn)
    const isCsvName = /\.csv$/i.test(base)
    const isCsvMime = lowerCt.includes('text/csv') || lowerCt.includes('application/csv')
    const isOctet = lowerCt.includes('application/octet-stream') || lowerCt.includes('application/download')
    if (!isCsvName && !isCsvMime) return
    if (isOctet && !isCsvName) return

    const buf = decodePartBody(body, headers['content-transfer-encoding'])
    const text = csvBytesToString(buf)
    if (!text.trim()) return

    out.push({ filename: fn || 'attachment.csv', csvText: text })
  }

  visit(raw)
  return out
}

export function decodeSubjectForForecast(subjectRaw: string): string {
  return decodeMimeWords(subjectRaw.trim().replace(/\s+/g, ' '))
}

/** Onderwerp FORESCO.CSV of FOR1234 (Atlas automail); geen FOR_PILS e.d. */
export function isForecastAtlasMailSubject(subjectRaw: string): boolean {
  const subj = decodeSubjectForForecast(subjectRaw).trim()
  if (/pils/i.test(subj)) return false
  return /^foresco\.csv$/i.test(subj) || /^for\d+$/i.test(subj)
}

export function pickForecastCsvForMail(
  subjectRaw: string,
  attachments: ForecastCsvAttachment[]
): ForecastCsvAttachment | null {
  if (attachments.length === 0) return null
  const subj = decodeSubjectForForecast(subjectRaw).trim()
  const subLower = subj.toLowerCase()

  if (/^for\d+$/i.test(subj)) {
    const target = `${subLower}.csv`
    const hit = attachments.find((a) => basenameLower(a.filename) === target)
    if (hit) return hit
  }
  if (/^foresco\.csv$/i.test(subj)) {
    const hit = attachments.find(
      (a) => basenameLower(a.filename).includes('foresco') && basenameLower(a.filename).endsWith('.csv')
    )
    if (hit) return hit
  }
  return attachments[0]
}
