import { NextRequest, NextResponse } from 'next/server'
import { sendPackedItemsAirtecReport } from '@/lib/airtec/packed-items-report-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, date_from, date_to } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    const result = await sendPackedItemsAirtecReport({
      recipients: email,
      dateFrom: date_from,
      dateTo: date_to,
    })

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${email}`,
      itemsCount: result.itemsCount,
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

