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
  getMessageDedupeKey,
  getBelgiumDate,
  getBelgiumDateDaysAgo,
  toImapDate,
} from '@/lib/grote-inpak/imap-mail-core'
import {
  extractForecastCsvAttachmentsFromRawMessage,
  isForecastAtlasMailSubject,
  pickForecastCsvForMail,
} from '@/lib/grote-inpak/extract-forecast-csv-from-mail'
import { parseForecastCSV } from '@/lib/grote-inpak/parse-forecast-csv'
import { applyForecastSave } from '@/lib/grote-inpak/apply-forecast-save'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.GROTE_INPAK_FORECAST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_KIST_MAIL_IMPORT_SECRET ||
    process.env.GROTE_INPAK_PILS_MAIL_IMPORT_SECRET ||
    process.env.AIRTEC_MAIL_IMPORT_SECRET ||
    process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerSecret =
    request.headers.get('x-grote-inpak-forecast-import-secret') ||
    request.headers.get('x-grote-inpak-kist-import-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return bearer === secret || headerSecret === secret || querySecret === secret
}

async function isForecastMailAlreadyProcessed(messageId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('grote_inpak_forecast_mail_processed')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function recordForecastMailProcessed(messageId: string, sourceFile: string): Promise<void> {
  const { error } = await supabaseAdmin.from('grote_inpak_forecast_mail_processed').insert({
    message_id: messageId,
    source_file: sourceFile,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
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

  const rawExplicit = request.nextUrl.searchParams.get('date')
  const rawSince = Number(request.nextUrl.searchParams.get('sinceDaysAgo'))
  const sinceDaysAgo = Number.isFinite(rawSince) ? Math.min(14, Math.max(0, rawSince)) : 1
  const brusselsClock = parseBrusselsClockHHmm(request.nextUrl.searchParams.get('brusselsNotBefore') || '')
  const brusselsFilterDayYmd = request.nextUrl.searchParams.get('brusselsFilterDay') || getBelgiumDate()
  const explicitDate = rawExplicit || (brusselsClock ? brusselsFilterDayYmd : null)
  const date = explicitDate || getBelgiumDateDaysAgo(sinceDaysAgo)

  const useUnseenOnly =
    request.nextUrl.searchParams.get('unseenOnly') === 'true' ||
    request.nextUrl.searchParams.get('includeSeen') === 'false' ||
    (process.env.GROTE_INPAK_FORECAST_MAIL_UNSEEN_ONLY === 'true' &&
      request.nextUrl.searchParams.get('includeSeen') !== 'true')

  if (!host || !user || !password) {
    return NextResponse.json({ error: 'Mail import env vars ontbreken' }, { status: 500 })
  }

  let client: SimpleImapClient | null = null
  const imported: Array<{ subject: string; source_file: string; row_count: number }> = []
  const skipped: Array<{ messageId: string; reason: string }> = []
  const errors: Array<{ messageId: string; error: string }> = []

  try {
    client = await SimpleImapClient.connect(host, port)
    await client.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`, 'LOGIN', 60000)
    await client.command(`SELECT ${imapQuote(mailbox)}`, 'SELECT mailbox')

    const searchQuery = `${useUnseenOnly ? 'UNSEEN ' : ''}SINCE ${toImapDate(date)}`.trim()
    const searchResponse = await client.command(`SEARCH ${searchQuery}`)
    const maxScanBase = Number(process.env.GROTE_INPAK_FORECAST_MAIL_MAX_SCAN || (brusselsClock ? 300 : 150))
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
        const subject = headers.subject || ''

        if (!isForecastAtlasMailSubject(subject)) {
          continue
        }

        if (await isForecastMailAlreadyProcessed(dedupeKey)) {
          skipped.push({ messageId: dedupeKey, reason: 'al_verwerkt' })
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
          continue
        }

        const attachments = extractForecastCsvAttachmentsFromRawMessage(rawMessage)
        const picked = pickForecastCsvForMail(subject, attachments)
        if (!picked) {
          errors.push({
            messageId: dedupeKey,
            error: 'Forecast-mail: geen CSV-bijlage gevonden',
          })
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
          continue
        }

        const rows = parseForecastCSV(picked.csvText, picked.filename)
        if (rows.length === 0) {
          errors.push({
            messageId: dedupeKey,
            error: `Forecast CSV parseerde 0 rijen (${picked.filename})`,
          })
          await client.command(`STORE ${id} +FLAGS (\\Seen)`)
          continue
        }

        const save = await applyForecastSave(rows, true)
        if (!save.ok) {
          errors.push({ messageId: dedupeKey, error: save.error })
          continue
        }

        await recordForecastMailProcessed(dedupeKey, picked.filename)
        imported.push({
          subject: subject.slice(0, 200),
          source_file: picked.filename,
          row_count: save.count,
        })
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
      sinceDaysAgo: rawExplicit || brusselsClock ? null : sinceDaysAgo,
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
    console.error('Grote Inpak forecast-mail import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mail import mislukt' },
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
}
