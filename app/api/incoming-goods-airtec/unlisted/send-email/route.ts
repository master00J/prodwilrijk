import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

const getEmailConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587')
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = process.env.SMTP_FROM || user
  return { host, port, secure, user, password, from }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, itemIds } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Een geldig e-mailadres is verplicht' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('airtec_unlisted_items')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (Array.isArray(itemIds) && itemIds.length > 0) {
      query = query.in('id', itemIds)
    }

    const { data: items, error } = await query

    if (error) {
      console.error('Error fetching unlisted items:', error)
      return NextResponse.json(
        { error: 'Kon items niet ophalen' },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Geen pending items om te versturen. Voeg items toe of selecteer items met status "pending".' },
        { status: 400 }
      )
    }

    const emailConfig = getEmailConfig()
    if (!emailConfig.user || !emailConfig.password) {
      return NextResponse.json(
        { error: 'E-mailconfiguratie ontbreekt. Stel SMTP_USER en SMTP_PASSWORD in.' },
        { status: 500 }
      )
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

    const rows = items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.beschrijving || '')}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.item_number || '-')}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.opmerking || '-')}</td>
          <td style="padding:8px;border:1px solid #ddd;">
            ${(item.photo_urls || []).length
              ? (item.photo_urls || [])
                  .map(
                    (url: string) =>
                      `<a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(url)}" alt="Foto" style="max-width:120px;max-height:90px;margin:2px;vertical-align:middle;" /></a>`
                  )
                  .join(' ')
              : '-'}
          </td>
        </tr>
      `
      )
      .join('')

    const html = `
      <p>Beste,</p>
      <p>Wij hebben onderstaande items ontvangen die niet in onze standaardlijst staan. Kunnen jullie bevestigen of we deze mogen verpakken?</p>
      <table style="border-collapse:collapse;width:100%;max-width:800px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Beschrijving</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Itemnummer</th>
            <th style="padding:8px;border:1px solid #ddd;">Aantal</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Opmerking</th>
            <th style="padding:8px;border:1px solid #ddd;">Foto's</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p>Met vriendelijke groet,<br/>Prodwilrijk</p>
    `

    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: 'Vraag: mogen we deze items verpakken? (niet in lijst)',
      text: `Wij hebben items ontvangen die niet in onze standaardlijst staan. Zie de bijlage of de e-mail in HTML voor het overzicht. Totaal: ${items.length} item(s).`,
      html,
    })

    const ids = items.map((i) => i.id)
    await supabaseAdmin
      .from('airtec_unlisted_items')
      .update({
        status: 'email_sent',
        email_sent_at: new Date().toISOString(),
      })
      .in('id', ids)

    return NextResponse.json({
      success: true,
      message: `E-mail verzonden naar ${email}`,
      itemsCount: items.length,
    })
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    const message = error instanceof Error ? error.message : 'Verzenden mislukt'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
