import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: number[] = Array.isArray(body?.ids) ? body.ids : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen bestellingen geselecteerd.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('bestellingen_algemeen')
      .select('id, artikel_omschrijving, artikelnummer, aantal, created_at')
      .in('id', ids)
      .order('created_at', { ascending: true })

    if (error || !data) {
      console.error('Error fetching bestellingen:', error)
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 })
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true'
    const user = process.env.SMTP_USER || ''
    const password = process.env.SMTP_PASSWORD || ''
    const from = process.env.SMTP_FROM || user

    if (!user || !password) {
      return NextResponse.json({ error: 'E-mail configuratie ontbreekt.' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: false },
    })

    const tableRows = data.map(r => `
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd;">${r.artikel_omschrijving}</td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${r.artikelnummer}</td>
        <td style="padding:6px 12px;border:1px solid #ddd;text-align:center;">${r.aantal}</td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${new Date(r.created_at).toLocaleDateString('nl-BE')}</td>
      </tr>`).join('')

    const html = `
      <p>Beste,</p>
      <p>Hieronder vindt u de openstaande algemene bestellingen van ${new Date().toLocaleDateString('nl-BE')}:</p>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Omschrijving</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Artikelnummer</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:center;">Aantal</th>
            <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Besteld op</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p>Met vriendelijke groet,<br>Foresco Wilrijk</p>`

    await transporter.sendMail({
      from: `"Bestellingen" <${from}>`,
      to: process.env.ORDER_EMAIL_TO || 'prodwilrijk@foresco.eu,j.ploegaerts@foresco.eu',
      subject: `Openstaande algemene bestellingen — ${new Date().toLocaleDateString('nl-BE')}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json({ error: error.message || 'E-mail versturen mislukt' }, { status: 500 })
  }
}
