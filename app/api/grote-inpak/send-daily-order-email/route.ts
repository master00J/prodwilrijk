import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildDailyOrderWorkbook } from '@/lib/grote-inpak/daily-order-excel'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TO_EMAIL = 'prodwilrijk@foresco.eu'

async function fetchKKistenForExcel(): Promise<any[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/grote-inpak/genk-urgency?only_not_in_wb=false`)
    if (!res.ok) return []
    const json = await res.json()
    const kData = json.data || []

    const { data: transferRows } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('kistnummer, quantity')
    const transferByKist = new Map<string, number>()
    ;(transferRows || []).forEach((row: any) => {
      const kt = row.kistnummer ? String(row.kistnummer).toUpperCase().trim() : ''
      if (kt) transferByKist.set(kt, (transferByKist.get(kt) || 0) + Number(row.quantity || 0))
    })

    const kRows: any[] = kData.map((r: any) => {
      const stockGenk = r.stock_genk ?? 0
      const stockWillebroek = r.stock_willebroek ?? 0
      const stockWilrijk = r.stock_wilrijk ?? 0
      const inTransfer = transferByKist.get(r.case_type) || 0
      const beschikbaar = stockGenk + stockWillebroek + stockWilrijk + inTransfer
      const tekort = Math.max(0, (r.total_count || 0) - beschikbaar)
      const status =
        tekort > 0 && beschikbaar === 0 ? 'Leeg'
        : tekort > 0 ? 'Productie aanmaken'
        : beschikbaar < (r.total_count || 0) ? 'Gedekt'
        : 'Vol'

      return {
        case_type: r.case_type,
        productielocatie: 'Genk',
        max_voorraad: r.total_count ?? 0,
        stock_in_rek: stockWillebroek,
        stock_genk: stockGenk,
        stock_wilrijk: stockWilrijk,
        in_productie: r.stock_in_productie ?? 0,
        in_transfer: inTransfer,
        op_pils: r.total_count ?? 0,
        tekort,
        status,
      }
    })

    kRows.sort((a, b) => {
      const stockA = (a.stock_in_rek ?? 0) + (a.stock_genk ?? 0) + (a.stock_wilrijk ?? 0)
      const stockB = (b.stock_in_rek ?? 0) + (b.stock_genk ?? 0) + (b.stock_wilrijk ?? 0)
      if (stockA !== stockB) return stockA - stockB
      return String(a.case_type || '').localeCompare(String(b.case_type || ''))
    })
    return kRows.map((r, i) => ({ ...r, priority_rank: i + 1 }))
  } catch {
    return []
  }
}

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

    const kKisten = await fetchKKistenForExcel()

    const wb = buildDailyOrderWorkbook('Genk', renumbered, today, { kKisten })
    const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
    const filename = `Daily_order_Genk_${dateStr}.xlsx`

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: TO_EMAIL,
      subject: `Dagelijkse order C & K kisten Genk ${today}`,
      html: `
        <p>Goedemorgen,</p>
        <p>In bijlage status C en K kisten ${today}</p>
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
