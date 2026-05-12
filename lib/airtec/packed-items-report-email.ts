import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import nodemailer from 'nodemailer'

const REPORT_TIME_ZONE = 'Europe/Brussels'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
}

interface SendPackedItemsAirtecReportOptions {
  recipients: string | string[]
  dateFrom?: string | null
  dateTo?: string | null
  from?: string
  skipIfEmpty?: boolean
}

export interface SendPackedItemsAirtecReportResult {
  sent: boolean
  skipped: boolean
  recipients: string[]
  itemsCount: number
  dateFrom: string
  dateTo: string
  filename?: string
}

function getEmailConfig(fromOverride?: string): EmailConfig {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = fromOverride || process.env.SMTP_FROM || user

  return { host, port, secure, user, password, from }
}

function normalizeRecipients(recipients: string | string[]): string[] {
  const list = Array.isArray(recipients) ? recipients : recipients.split(',')
  return list.map(email => email.trim()).filter(email => email.includes('@'))
}

function formatDateInputInTimeZone(date: Date, timeZone = REPORT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10)
  }

  return `${year}-${month}-${day}`
}

function getTimeZoneOffsetMinutes(date: Date, timeZone = REPORT_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find(part => part.type === type)?.value)
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')

  const normalizedHour = hour === 24 ? 0 : hour
  const zonedAsUtc = Date.UTC(year, month - 1, day, normalizedHour, minute, second)
  return Math.round((zonedAsUtc - date.getTime()) / 60000)
}

function dateInputToUtcIso(dateInput: string, endOfDay: boolean): string {
  const [year, month, day] = dateInput.split('-').map(Number)
  const utcGuess = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    )
  )
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess)
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000).toISOString()
}

export function getTodayInBelgium(): string {
  return formatDateInputInTimeZone(new Date())
}

export async function sendPackedItemsAirtecReport({
  recipients,
  dateFrom,
  dateTo,
  from,
  skipIfEmpty = false,
}: SendPackedItemsAirtecReportOptions): Promise<SendPackedItemsAirtecReportResult> {
  const normalizedRecipients = normalizeRecipients(recipients)
  if (normalizedRecipients.length === 0) {
    throw new Error('Geen geldig e-mailadres opgegeven')
  }

  const effectiveFrom = dateFrom || 'all'
  const effectiveTo = dateTo || 'all'

  let query = supabaseAdmin
    .from('packed_items_airtec')
    .select('*')
    .order('date_packed', { ascending: false })

  if (dateFrom) {
    query = query.gte('date_packed', dateInputToUtcIso(dateFrom, false))
  }

  if (dateTo) {
    query = query.lte('date_packed', dateInputToUtcIso(dateTo, true))
  }

  const { data: items, error } = await query

  if (error) {
    console.error('Error fetching packed items airtec:', error)
    throw new Error('Failed to fetch packed items')
  }

  if (!items || items.length === 0) {
    if (skipIfEmpty) {
      return {
        sent: false,
        skipped: true,
        recipients: normalizedRecipients,
        itemsCount: 0,
        dateFrom: effectiveFrom,
        dateTo: effectiveTo,
      }
    }
    throw new Error('No packed items found for the selected date range')
  }

  const worksheet = XLSX.utils.json_to_sheet(
    items.map(item => ({
      ID: item.id,
      Description: item.beschrijving || '',
      'Item Number': item.item_number || '',
      'Lot Number': item.lot_number || '',
      'Date Sent': item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '',
      'Box Number': item.kistnummer || '',
      Division: item.divisie || '',
      Quantity: item.quantity,
      'Date Received': new Date(item.datum_ontvangen).toLocaleDateString(),
      'Date Packed': new Date(item.date_packed).toLocaleDateString(),
    }))
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Packed Items Airtec')
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  const emailConfig = getEmailConfig(from)
  if (!emailConfig.user || !emailConfig.password) {
    throw new Error('Email configuration is missing. Please set SMTP_USER and SMTP_PASSWORD environment variables.')
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  })

  const filename = `packed_items_airtec_${effectiveFrom}_to_${effectiveTo}.xlsx`
  const recipientsText = normalizedRecipients.join(', ')

  await transporter.sendMail({
    from: emailConfig.from,
    to: recipientsText,
    subject: `Packed Items Airtec Report - ${effectiveFrom} to ${effectiveTo}`,
    text: `Please find attached the packed items Airtec report for the date range ${effectiveFrom} to ${effectiveTo}.\n\nTotal items: ${items.length}`,
    html: `
      <p>Please find attached the packed items Airtec report for the date range <strong>${effectiveFrom}</strong> to <strong>${effectiveTo}</strong>.</p>
      <p>Total items: <strong>${items.length}</strong></p>
    `,
    attachments: [
      {
        filename,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  })

  return {
    sent: true,
    skipped: false,
    recipients: normalizedRecipients,
    itemsCount: items.length,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
    filename,
  }
}
