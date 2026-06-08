import { NextRequest, NextResponse } from 'next/server'
import {
  SimpleImapClient,
  imapQuote,
  extractSearchIds,
  extractFetchBody,
  extractInternalDateFromFetch,
  parseImapInternalDateToMs,
  parseBrusselsClockHHmm,
  internalDateMeetsBrusselsNotBefore,
  splitHeaderAndBody,
  getBoundary,
  decodePartBody,
  bufferToPlainString,
  getMessageDedupeKey,
  getBelgiumDate,
  getBelgiumDateDaysAgo,
  toImapDate,
} from '@/lib/grote-inpak/imap-mail-core'
import { parseKistTePakkenBody, parseKistTePakkenSubject } from '@/lib/grote-inpak/parse-kist-te-pakken-mail'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import { mergeLabelDetails } from '@/lib/grote-inpak/upload-log-labels'
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

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.GROTE_INPAK_KIST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret = request.headers.get('x-grote-inpak-kist-import-secret')

  return bearer === secret || headerSecret === secret
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
  caseType: string | null,
  wasInsert: boolean,
  depth = 0
): Promise<void> {
  if (depth > 5) {
    console.error('kist mail upload log: te veel retries')
    return
  }

  const { data: row, error: selErr } = await supabaseAdmin
    .from('grote_inpak_kist_mail_upload_log')
    .select('mail_count, cases_inserted, cases_updated, case_labels, case_labels_detail')
    .eq('log_date', logDate)
    .maybeSingle()

  if (selErr) {
    console.error('kist mail upload log select:', selErr.message)
    return
  }

  const ts = new Date().toISOString()
  const label = caseLabel.trim()
  const labelDetail = { label, case_type: caseType?.trim() || null }
  if (!row) {
    const { error } = await supabaseAdmin.from('grote_inpak_kist_mail_upload_log').insert({
      log_date: logDate,
      mail_count: 1,
      cases_inserted: wasInsert ? 1 : 0,
      cases_updated: wasInsert ? 0 : 1,
      case_labels: [label],
      case_labels_detail: [labelDetail],
      last_event_at: ts,
    })
    if (error?.code === '23505') {
      await bumpKistMailDailyLog(logDate, caseLabel, caseType, wasInsert, depth + 1)
      return
    }
    if (error) console.error('kist mail upload log insert:', error.message)
    return
  }

  const prevLabels = Array.isArray(row.case_labels) ? row.case_labels : []
  const case_labels = Array.from(new Set([...prevLabels.map(String), label])).sort()
  const case_labels_detail = mergeLabelDetails(row.case_labels_detail, labelDetail)

  const { error } = await supabaseAdmin
    .from('grote_inpak_kist_mail_upload_log')
    .update({
      mail_count: (row.mail_count ?? 0) + 1,
      cases_inserted: (row.cases_inserted ?? 0) + (wasInsert ? 1 : 0),
      cases_updated: (row.cases_updated ?? 0) + (wasInsert ? 0 : 1),
      case_labels,
      case_labels_detail,
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
        await bumpKistMailDailyLog(getBelgiumDate(), parsed.case_label, parsed.case_type, wasInsert)
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
