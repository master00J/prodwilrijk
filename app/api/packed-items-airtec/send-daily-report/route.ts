import { NextRequest, NextResponse } from 'next/server'
import {
  getTodayInBelgium,
  sendPackedItemsAirtecReport,
} from '@/lib/airtec/packed-items-report-email'

export const dynamic = 'force-dynamic'

const DEFAULT_RECIPIENTS = ['Jasonploegaerts@gmail.com', 'jason@foresco.eu']
const DEFAULT_FROM = 'Jason <Jason@prodwilrijk.be>'

function getRecipients(): string[] {
  const configured = process.env.AIRTEC_DAILY_REPORT_RECIPIENTS
  if (!configured) return DEFAULT_RECIPIENTS
  return configured.split(',').map(email => email.trim()).filter(Boolean)
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.AIRTEC_DAILY_REPORT_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function sendDailyReport(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date') || getTodayInBelgium()

  try {
    const result = await sendPackedItemsAirtecReport({
      recipients: getRecipients(),
      dateFrom: date,
      dateTo: date,
      from: process.env.AIRTEC_DAILY_REPORT_FROM || DEFAULT_FROM,
      skipIfEmpty: true,
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: result.skipped
        ? `Geen Airtec packed items gevonden voor ${date}; geen mail verzonden.`
        : `Dagelijks Airtec rapport verzonden voor ${date}.`,
    })
  } catch (error: any) {
    console.error('Error sending daily packed items Airtec report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send daily report' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return sendDailyReport(request)
}

export async function POST(request: NextRequest) {
  return sendDailyReport(request)
}
