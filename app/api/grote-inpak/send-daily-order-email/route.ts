import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildDailyOrderWorkbook } from '@/lib/grote-inpak/daily-order-excel'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TO_EMAIL = 'prodwilrijk@foresco.eu'

async function fetchProductieWilrijkByKist(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const { data: stockData } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, location, kistnummer, productie')
    const { data: erpLink } = await supabaseAdmin.from('grote_inpak_erp_link').select('kistnummer, erp_code')
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer) erpToKist.set(String(e.erp_code).toUpperCase().trim(), String(e.kistnummer).toUpperCase().trim())
    })
    ;(stockData || []).forEach((s: any) => {
      const prod = Math.max(0, Number(s.productie || 0))
      if (prod === 0) return
      const loc = String(s.location || '').toLowerCase()
      if (!loc.includes('wilrijk')) return
      let kist = s.kistnummer ? String(s.kistnummer).toUpperCase().trim() : null
      if (!kist && s.erp_code) kist = erpToKist.get(String(s.erp_code).toUpperCase().trim()) || null
      if (kist) {
        if (kist.startsWith('V')) kist = 'K' + kist.substring(1)
        map.set(kist, (map.get(kist) || 0) + prod)
      }
    })
  } catch (_) {}
  return map
}

async function fetchKKistenForExcel(productieWilrijkByKist: Map<string, number>): Promise<any[]> {
  try {
    const { data: cases } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date, erp_code, stapel')
      .or('case_type.ilike.K%,case_type.ilike.V%')
      .eq('productielocatie', 'Genk')

    if (!cases || cases.length === 0) return []

    const { data: stockData } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, location, quantity, kistnummer, productie')

    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const { data: transferRows } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('kistnummer, quantity')

    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer) {
        erpToKist.set(String(e.erp_code).toUpperCase().trim(), String(e.kistnummer).toUpperCase().trim())
      }
    })

    const norm = (x: string) => {
      const t = String(x || '').trim().toUpperCase()
      return t.startsWith('V') ? 'K' + t.substring(1) : t
    }

    const stockByKist = new Map<string, Map<string, number>>()
    const productieByKist = new Map<string, number>()
    ;(stockData || []).forEach((s: any) => {
      let kist = s.kistnummer ? String(s.kistnummer).toUpperCase().trim() : null
      if (!kist && s.erp_code) kist = erpToKist.get(String(s.erp_code).toUpperCase().trim()) || null
      if (!kist) return
      kist = norm(kist)

      const loc = String(s.location || '').toLowerCase()
      const qty = Number(s.quantity || 0)
      const prod = Number(s.productie || 0)
      if (!stockByKist.has(kist)) stockByKist.set(kist, new Map())
      stockByKist.get(kist)!.set(loc, (stockByKist.get(kist)!.get(loc) || 0) + qty)
      if (prod > 0) productieByKist.set(kist, (productieByKist.get(kist) || 0) + prod)
    })

    const transferByKist = new Map<string, number>()
    ;(transferRows || []).forEach((row: any) => {
      let kt = row.kistnummer ? String(row.kistnummer).toUpperCase().trim() : ''
      if (kt) { kt = norm(kt); transferByKist.set(kt, (transferByKist.get(kt) || 0) + Number(row.quantity || 0)) }
    })

    const grouped = new Map<string, { case_type: string; total_count: number }>()
    ;(cases || []).forEach((c: any) => {
      const kt = norm(c.case_type || '')
      if (!grouped.has(kt)) grouped.set(kt, { case_type: kt, total_count: 0 })
      grouped.get(kt)!.total_count++
    })

    const kRows: any[] = []
    grouped.forEach((data, caseType) => {
      const stockMap = stockByKist.get(caseType) || new Map()
      let stockGenk = 0, stockWB = 0, stockWilrijk = 0
      stockMap.forEach((qty, loc) => {
        if (loc.includes('genk')) stockGenk += qty
        else if (loc.includes('willebroek') || loc === 'wlb') stockWB += qty
        else if (loc.includes('wilrijk')) stockWilrijk += qty
      })
      const inProductie = productieByKist.get(caseType) || 0
      const inProductieWilrijk = productieWilrijkByKist.get(caseType) || 0  // Genk hoeft niet te produceren wat Wilrijk doet
      const inTransfer = transferByKist.get(caseType) || 0
      const beschikbaar = stockGenk + stockWB + stockWilrijk + inTransfer
      const tekortTotaal = Math.max(0, data.total_count - beschikbaar)
      // Excel is Genk-gericht: productie in Wilrijk hoeft Genk niet te doen → effectief 0
      const tekort = Math.max(0, tekortTotaal - inProductieWilrijk)
      const status =
        tekortTotaal > 0 && beschikbaar === 0 ? 'Leeg'
        : tekortTotaal > 0 ? 'Productie aanmaken'
        : beschikbaar < data.total_count ? 'Gedekt'
        : 'Vol'

      kRows.push({
        case_type: caseType,
        productielocatie: 'Genk',
        max_voorraad: data.total_count,
        stock_in_rek: stockWB,
        stock_genk: stockGenk,
        stock_wilrijk: stockWilrijk,
        in_productie: inProductie,
        in_transfer: inTransfer,
        op_pils: data.total_count,
        tekort,
        status,
      })
    })

    kRows.sort((a, b) => {
      const stockA = (a.stock_in_rek ?? 0) + (a.stock_genk ?? 0) + (a.stock_wilrijk ?? 0)
      const stockB = (b.stock_in_rek ?? 0) + (b.stock_genk ?? 0) + (b.stock_wilrijk ?? 0)
      if (stockA !== stockB) return stockA - stockB
      return String(a.case_type || '').localeCompare(String(b.case_type || ''))
    })
    return kRows.map((r, i) => ({ ...r, priority_rank: i + 1 }))
  } catch (err) {
    console.error('fetchKKistenForExcel:', err)
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

    const productieWilrijkByKist = await fetchProductieWilrijkByKist()
    const normCase = (x: string) => { const t = String(x || '').trim().toUpperCase(); return t.startsWith('V') ? 'K' + t.substring(1) : t }
    const renumbered = genkRows.map((r: any, i: number) => {
      const kt = normCase(r.case_type || '')
      const inProdW = productieWilrijkByKist.get(kt) || 0
      const tekort = Math.max(0, (r.tekort ?? 0) - inProdW)
      return { ...r, priority_rank: i + 1, tekort }
    })

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]

    const kKisten = await fetchKKistenForExcel(productieWilrijkByKist)

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
