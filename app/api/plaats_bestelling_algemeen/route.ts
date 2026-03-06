import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

async function sendOrderEmail(rows: { artikel_omschrijving: string; artikelnummer: string; aantal: number }[]) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587')
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = process.env.SMTP_FROM || user
  if (!user || !password) return

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass: password }, tls: { rejectUnauthorized: false } })

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #ddd;">${r.artikel_omschrijving}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;">${r.artikelnummer}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:center;">${r.aantal}</td>
    </tr>`).join('')

  const html = `
    <p>Beste,</p>
    <p>Hieronder vindt u de nieuwe algemene bestelling van ${new Date().toLocaleDateString('nl-BE')}:</p>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Omschrijving</th>
          <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Artikelnummer</th>
          <th style="padding:6px 12px;border:1px solid #ddd;text-align:center;">Aantal</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p>Met vriendelijke groet,<br>Foresco Wilrijk</p>`

  await transporter.sendMail({
    from: `"Bestellingen" <${from}>`,
    to: process.env.ORDER_EMAIL_TO || 'prodwilrijk@foresco.eu,j.ploegaerts@foresco.eu',
    subject: `Nieuwe algemene bestelling — ${new Date().toLocaleDateString('nl-BE')}`,
    html,
  })
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OrderItem = {
  description: string
  articleNumber: string
  quantity: number
}

type UpdateReceivedBody = {
  ids: number[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const openOnly = searchParams.get('open_only') === 'true'

    let query = supabaseAdmin
      .from('bestellingen_algemeen')
      .select('id, artikel_omschrijving, artikelnummer, aantal, ontvangen, created_at')
      .order('created_at', { ascending: false })

    if (openOnly) {
      query = query.eq('ontvangen', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching bestellingen:', error)
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderList: OrderItem[] = Array.isArray(body?.orderList) ? body.orderList : []

    if (orderList.length === 0) {
      return NextResponse.json({ error: 'Geen artikelen geselecteerd.' }, { status: 400 })
    }

    const rows = orderList.map((item) => ({
      artikel_omschrijving: String(item.description || '').trim(),
      artikelnummer: String(item.articleNumber || '').trim(),
      aantal: Number(item.quantity) || 0,
      ontvangen: false,
    }))

    const { error } = await supabaseAdmin.from('bestellingen_algemeen').insert(rows)

    if (error) {
      console.error('Error inserting bestelling:', error)
      return NextResponse.json({ error: 'Database insert error' }, { status: 500 })
    }

    try {
      await sendOrderEmail(rows)
    } catch (mailErr) {
      console.error('E-mail versturen mislukt (bestelling wel opgeslagen):', mailErr)
    }

    return NextResponse.json({ success: true, message: 'Algemene bestelling geplaatst.' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateReceivedBody
    const ids = Array.isArray(body?.ids) ? body.ids : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen bestellingen geselecteerd.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bestellingen_algemeen')
      .update({ ontvangen: true })
      .in('id', ids)

    if (error) {
      console.error('Error updating bestellingen:', error)
      return NextResponse.json({ error: 'Database update error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
