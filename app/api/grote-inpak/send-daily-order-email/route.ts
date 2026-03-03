import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildDailyOrderWorkbook } from '@/lib/grote-inpak/daily-order-excel'

export const dynamic = 'force-dynamic'

const TO_EMAIL = 'prodwilrijk@foresco.eu'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rows, alleenBestellen } = body

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Geen data om te versturen' }, { status: 400 })
    }

    const smtpUser = process.env.SMTP_USER || ''
    const smtpPass = process.env.SMTP_PASSWORD || ''
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP configuratie ontbreekt' }, { status: 500 })
    }

    // Filter enkel Genk-rijen
    const toExport = alleenBestellen
      ? rows.filter((r: any) => r.bestel_aantal > 0)
      : rows
    const genkRows = toExport.filter((r: any) =>
      String(r.productielocatie || '').toLowerCase().includes('genk')
    )

    if (genkRows.length === 0) {
      return NextResponse.json({ error: 'Geen Genk-kisten gevonden' }, { status: 400 })
    }

    // Hernummer voor Genk-specifieke lijst
    const renumbered = genkRows.map((r: any, i: number) => ({ ...r, priority_rank: i + 1 }))

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]

    const wb = buildDailyOrderWorkbook('Genk', renumbered, today)
    const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
    const filename = `C_kisten_daily_order_Genk_${dateStr}.xlsx`

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: TO_EMAIL,
      subject: `Dagelijkse order C kisten Genk ${today}`,
      html: `
        <p>Goedemorgen,</p>
        <p>In bijlage status C kisten ${today}</p>
        <p>Met vriendelijke groeten,<br/>Jason</p>
      `,
      attachments: [
        {
          filename,
          content: Buffer.from(buffer),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    return NextResponse.json({ success: true, message: `E-mail verstuurd naar ${TO_EMAIL}` })
  } catch (error: any) {
    console.error('Fout bij versturen daily order e-mail:', error)
    return NextResponse.json({ error: error.message || 'Versturen mislukt' }, { status: 500 })
  }
}
