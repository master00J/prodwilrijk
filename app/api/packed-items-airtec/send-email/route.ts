import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

// Email configuration - should be in environment variables
const getEmailConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587')
  const secure = process.env.SMTP_SECURE === 'true' // true for 465, false for other ports
  const user = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = process.env.SMTP_FROM || user

  return { host, port, secure, user, password, from }
}

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

    // Build query for packed items airtec
    let query = supabaseAdmin
      .from('packed_items_airtec')
      .select('*')
      .order('date_packed', { ascending: false })

    // Apply date filters
    if (date_from) {
      const fromDate = new Date(date_from)
      fromDate.setHours(0, 0, 0, 0)
      query = query.gte('date_packed', fromDate.toISOString())
    }

    if (date_to) {
      const toDate = new Date(date_to)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte('date_packed', toDate.toISOString())
    }

    const { data: items, error } = await query

    if (error) {
      console.error('Error fetching packed items airtec:', error)
      return NextResponse.json(
        { error: 'Failed to fetch packed items' },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No packed items found for the selected date range' },
        { status: 400 }
      )
    }

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(
      items.map(item => ({
        'ID': item.id,
        'Description': item.beschrijving || '',
        'Item Number': item.item_number || '',
        'Lot Number': item.lot_number || '',
        'Date Sent': item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '',
        'Box Number': item.kistnummer || '',
        'Division': item.divisie || '',
        'Quantity': item.quantity,
        'Date Received': new Date(item.datum_ontvangen).toLocaleDateString(),
        'Date Packed': new Date(item.date_packed).toLocaleDateString(),
      }))
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Packed Items Airtec')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Email configuration
    const emailConfig = getEmailConfig()

    if (!emailConfig.user || !emailConfig.password) {
      return NextResponse.json(
        { error: 'Email configuration is missing. Please set SMTP_USER and SMTP_PASSWORD environment variables.' },
        { status: 500 }
      )
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    })

    // Date range string for filename and subject
    const dateFromStr = date_from ? new Date(date_from).toISOString().split('T')[0] : 'all'
    const dateToStr = date_to ? new Date(date_to).toISOString().split('T')[0] : 'all'
    const filename = `packed_items_airtec_${dateFromStr}_to_${dateToStr}.xlsx`

    // Send email
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Packed Items Airtec Report - ${dateFromStr} to ${dateToStr}`,
      text: `Please find attached the packed items Airtec report for the date range ${dateFromStr} to ${dateToStr}.\n\nTotal items: ${items.length}`,
      html: `
        <p>Please find attached the packed items Airtec report for the date range <strong>${dateFromStr}</strong> to <strong>${dateToStr}</strong>.</p>
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

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${email}`,
      itemsCount: items.length,
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

