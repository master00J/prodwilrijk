import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

type ReorderItem = {
  kistnummer: string
  erp_code?: string | null
  huidige_voorraad?: number
  minimum_voorraad?: number
  te_bestellen?: number
}

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.AIRTEC_KISTEN_REORDER_SECRET
  if (!secret) return false
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return bearer === secret
}

function isBrusselsReorderWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || ''
  const weekday = getPart('weekday')
  const hour = Number(getPart('hour'))
  const minute = Number(getPart('minute'))
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday) && hour === 15 && minute === 15
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function loadItemsToOrder(): Promise<ReorderItem[]> {
  const { data, error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .select('kistnummer, erp_code, huidige_voorraad, minimum_voorraad')
    .order('kistnummer', { ascending: true })

  if (error) throw error

  return (data || [])
    .map((row: any) => ({
      ...row,
      te_bestellen: Math.max(0, Number(row.minimum_voorraad || 0) - Number(row.huidige_voorraad || 0)),
    }))
    .filter((item: ReorderItem) => Number(item.te_bestellen || 0) > 0)
    .sort((a: ReorderItem, b: ReorderItem) => Number(b.te_bestellen || 0) - Number(a.te_bestellen || 0))
}

async function sendReorderEmail({
  items,
  notes,
  sentBy,
}: {
  items: ReorderItem[]
  notes?: string
  sentBy: string
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { sent: false, totalItems: 0 }
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587')
  const secure = process.env.SMTP_SECURE === 'true'
  const smtpUser = process.env.SMTP_USER || ''
  const password = process.env.SMTP_PASSWORD || ''
  const from = process.env.SMTP_FROM || smtpUser

  if (!smtpUser || !password) {
    throw new Error('E-mail configuratie ontbreekt')
  }

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user: smtpUser, pass: password },
  })

  const today = new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const tableRows = items.map((item: ReorderItem) =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold">${escapeHtml(item.kistnummer)}</td>
      <td style="padding:8px 12px;border:1px solid #ddd">${escapeHtml(item.erp_code || '—')}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#c00">${Number(item.te_bestellen || 0)}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${Number(item.huidige_voorraad || 0)}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${Number(item.minimum_voorraad || 0)}</td>
    </tr>`
  ).join('')

  const totalItems = items.reduce((s: number, i: ReorderItem) => s + Number(i.te_bestellen || 0), 0)
  const safeNotes = notes ? escapeHtml(notes) : ''

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
        ${safeNotes ? `<p style="margin:0 0 16px;font-size:13px;color:#555;background:#fff;padding:12px;border-radius:6px;border:1px solid #eee"><strong>Opmerking:</strong> ${safeNotes}</p>` : ''}
        <p style="margin:16px 0 0;font-size:12px;color:#999">
          Verzonden via Prodwilrijk V2 door ${escapeHtml(sentBy)}
        </p>
      </div>
    </div>
  `

  const reorderTo =
    process.env.KISTEN_REORDER_EMAIL_TO || 'prodwilrijk@foresco.eu'

  await transporter.sendMail({
    from,
    to: reorderTo,
    subject: `Bestelling Stagekisten — ${today} (${totalItems} stuks)`,
    html,
  })

  return { sent: true, totalItems }
}

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const { items, notes } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Geen items om te bestellen' }, { status: 400 })
    }

    await sendReorderEmail({
      items,
      notes,
      sentBy: user.email || 'gebruiker',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('send-reorder error:', err)
    return NextResponse.json({ error: err.message || 'Verzenden mislukt' }, { status: 500 })
  }
})

export async function GET(request: NextRequest) {
  try {
    if (!cronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isBrusselsReorderWindow()) {
      return NextResponse.json({ success: true, sent: false, reason: 'Buiten het geplande 15:15 Brussels venster' })
    }

    const items = await loadItemsToOrder()
    if (items.length === 0) {
      return NextResponse.json({ success: true, sent: false, reason: 'Geen items om te bestellen' })
    }

    const result = await sendReorderEmail({
      items,
      sentBy: 'automatische planning',
    })

    return NextResponse.json({
      success: true,
      sent: result.sent,
      count: items.length,
      totalItems: result.totalItems,
    })
  } catch (err: any) {
    console.error('send-reorder cron error:', err)
    return NextResponse.json({ error: err.message || 'Automatisch verzenden mislukt' }, { status: 500 })
  }
}
