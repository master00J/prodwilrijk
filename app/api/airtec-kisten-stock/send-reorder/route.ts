import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const { items, notes } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Geen items om te bestellen' }, { status: 400 })
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true'
    const smtpUser = process.env.SMTP_USER || ''
    const password = process.env.SMTP_PASSWORD || ''
    const from = process.env.SMTP_FROM || smtpUser

    if (!smtpUser || !password) {
      return NextResponse.json({ error: 'E-mail configuratie ontbreekt' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user: smtpUser, pass: password },
    })

    const today = new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const tableRows = items.map((item: any) =>
      `<tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold">${item.kistnummer}</td>
        <td style="padding:8px 12px;border:1px solid #ddd">${item.erp_code || '—'}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#c00">${item.te_bestellen}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${item.huidige_voorraad}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${item.minimum_voorraad}</td>
      </tr>`
    ).join('')

    const totalItems = items.reduce((s: number, i: any) => s + (i.te_bestellen || 0), 0)

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#1a5632;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">Bestelling Stagekisten — ${today}</h2>
          <p style="margin:4px 0 0;opacity:0.85;font-size:14px">Foresco BE NV — Locatie Wilrijk</p>
        </div>
        <div style="padding:20px 24px;background:#f9f9f9;border:1px solid #ddd;border-top:none">
          <p style="margin:0 0 16px;font-size:14px;color:#333">
            Beste,<br><br>
            Gelieve onderstaande stagekisten te leveren. Totaal: <strong>${totalItems} stuks</strong> over ${items.length} kisttype(s).
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
            <thead>
              <tr style="background:#1a5632;color:white">
                <th style="padding:8px 12px;text-align:left">Kist</th>
                <th style="padding:8px 12px;text-align:left">ERP Code</th>
                <th style="padding:8px 12px;text-align:right">Bestellen</th>
                <th style="padding:8px 12px;text-align:right">Huidige stock</th>
                <th style="padding:8px 12px;text-align:right">Min. voorraad</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${notes ? `<p style="margin:0 0 16px;font-size:13px;color:#555;background:#fff;padding:12px;border-radius:6px;border:1px solid #eee"><strong>Opmerking:</strong> ${notes}</p>` : ''}
          <p style="margin:16px 0 0;font-size:12px;color:#999">
            Verzonden via Prodwilrijk V2 door ${user.email}
          </p>
        </div>
      </div>
    `

    await transporter.sendMail({
      from,
      to: 'prodwilrijk@foresco.eu',
      subject: `Bestelling Stagekisten — ${today} (${totalItems} stuks)`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('send-reorder error:', err)
    return NextResponse.json({ error: err.message || 'Verzenden mislukt' }, { status: 500 })
  }
})
