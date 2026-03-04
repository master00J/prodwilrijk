import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildDailyOrderWorkbook } from '@/lib/grote-inpak/daily-order-excel'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode, normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

export const dynamic = 'force-dynamic'

const TO_EMAIL = 'prodwilrijk@foresco.eu'

/** Haalt stock op voor C-kisten vanuit de database (zelfde logica als kanban-besteladvies) */
async function fetchStockForCKisten(caseTypes: string[]): Promise<Map<string, { genk: number; willebroek: number; wilrijk: number }>> {
  const stockByKist = new Map<string, { genk: number; willebroek: number; wilrijk: number }>()
  if (caseTypes.length === 0) return stockByKist
  try {
    const { data: stockRaw } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, location, quantity, item_number')
    const { data: erpLink } = await supabaseAdmin.from('grote_inpak_erp_link').select('kistnummer, erp_code')
    const { data: casesLink } = await supabaseAdmin.from('grote_inpak_cases').select('erp_code, case_type')
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer)
        erpToKist.set(normalizeErpCode(e.erp_code) || String(e.erp_code).toUpperCase().trim(), normalizeKistnummer(e.kistnummer))
    })
    const erpToCaseType = new Map<string, string>()
    ;(casesLink || []).forEach((c: any) => {
      const ct = c.case_type ? normalizeKistnummer(c.case_type) : null
      if (c.erp_code && ct) {
        const erpNorm = normalizeErpCode(c.erp_code)
        if (erpNorm) erpToCaseType.set(erpNorm, ct)
      }
    })
    ;(stockRaw || []).forEach((s: any) => {
      let kist = s.kistnummer ? normalizeKistnummer(s.kistnummer) : null
      const erpRaw = s.erp_code ? String(s.erp_code).trim() : ''
      const erpNorm = erpRaw ? normalizeErpCode(erpRaw) : null
      const itemNo = s.item_number ? String(s.item_number).toUpperCase().trim() : ''
      if (!kist && erpNorm) kist = erpToKist.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToKist.get(normalizeErpCode(itemNo) || itemNo) || null
      if (!kist && erpNorm) kist = erpToCaseType.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToCaseType.get(normalizeErpCode(itemNo) || itemNo) || null
      if (!kist && erpNorm && /^C\d+/.test(erpNorm)) kist = erpNorm
      if (!kist && itemNo && /^C\d+/.test(itemNo)) kist = itemNo
      if (!kist) return
      const loc = String(s.location || '').toLowerCase()
      const qty = Math.max(0, Number(s.quantity || 0))
      if (!stockByKist.has(kist)) stockByKist.set(kist, { genk: 0, willebroek: 0, wilrijk: 0 })
      const e = stockByKist.get(kist)!
      if (loc.includes('genk')) e.genk += qty
      else if (loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl') || loc.includes('items (64)') || loc.includes('items(64)')) e.willebroek += qty
      else if (loc.includes('wilrijk')) e.wilrijk += qty
    })
  } catch (_) {}
  return stockByKist
}

async function fetchProductieByLocatie(locatie: 'Genk' | 'Wilrijk'): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const keyword = locatie.toLowerCase()
  try {
    const { data: stockData } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, location, kistnummer, productie')
    const { data: erpLink } = await supabaseAdmin.from('grote_inpak_erp_link').select('kistnummer, erp_code')
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer) {
        const erpNorm = normalizeErpCode(e.erp_code)
        if (erpNorm) erpToKist.set(erpNorm, normalizeKistnummer(e.kistnummer))
      }
    })
    ;(stockData || []).forEach((s: any) => {
      const prod = Math.max(0, Number(s.productie || 0))
      if (prod === 0) return
      const loc = String(s.location || '').toLowerCase()
      if (!loc.includes(keyword)) return
      let kist = s.kistnummer ? normalizeKistnummer(s.kistnummer) : null
      const erpNorm = s.erp_code ? normalizeErpCode(s.erp_code) : null
      if (!kist && erpNorm) kist = erpToKist.get(erpNorm) || null
      if (kist) {
        if (kist.startsWith('V')) kist = 'K' + kist.substring(1)
        map.set(kist, (map.get(kist) || 0) + prod)
      }
    })
  } catch (_) {}
  return map
}

async function fetchKKistenForExcel(
  location: 'Genk' | 'Wilrijk',
  productieAndereLocByKist: Map<string, number>
): Promise<any[]> {
  try {
    const { data: cases } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date, erp_code, stapel, dagen_te_laat')
      .or('case_type.ilike.K%,case_type.ilike.V%')
      .eq('productielocatie', location)

    if (!cases || cases.length === 0) return []

    const { data: stockData } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, location, quantity, kistnummer, productie, item_number')

    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const { data: casesLink } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('erp_code, case_type')
      .or('case_type.ilike.K%,case_type.ilike.V%')

    const { data: transferRows } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('kistnummer, quantity')

    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer) {
        const erpNorm = normalizeErpCode(e.erp_code)
        if (erpNorm) erpToKist.set(erpNorm, String(e.kistnummer).toUpperCase().trim())
      }
    })
    const erpToCaseType = new Map<string, string>()
    ;(casesLink || []).forEach((c: any) => {
      const ct = c.case_type ? String(c.case_type).toUpperCase().trim() : null
      if (c.erp_code && ct) {
        const erpNorm = normalizeErpCode(c.erp_code)
        if (erpNorm) erpToCaseType.set(erpNorm, ct)
      }
    })

    const norm = (x: string) => normalizeKistnummer(x)

    const stockByKist = new Map<string, Map<string, number>>()
    const productieByKist = new Map<string, number>()
    const productieByKistPerLoc = new Map<string, { genk: number; wilrijk: number; willebroek: number }>()
    ;(stockData || []).forEach((s: any) => {
      let kist = s.kistnummer ? normalizeKistnummer(s.kistnummer) : null
      const erpNorm = s.erp_code ? normalizeErpCode(s.erp_code) : null
      const itemNo = s.item_number ? String(s.item_number).toUpperCase().trim() : ''
      if (!kist && erpNorm) kist = erpToKist.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToKist.get(normalizeErpCode(itemNo) || itemNo) || null
      if (!kist && erpNorm) kist = erpToCaseType.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToCaseType.get(normalizeErpCode(itemNo) || itemNo) || null
      if (!kist && erpNorm && /^[KV]\d+/.test(erpNorm)) kist = erpNorm
      if (!kist && itemNo && /^[KV]\d+/.test(itemNo)) kist = itemNo
      if (!kist) return
      kist = norm(kist)

      const loc = String(s.location || '').toLowerCase()
      const qty = Number(s.quantity || 0)
      const prod = Number(s.productie || 0)
      if (!stockByKist.has(kist)) stockByKist.set(kist, new Map())
      stockByKist.get(kist)!.set(loc, (stockByKist.get(kist)!.get(loc) || 0) + qty)
      if (prod > 0) {
        productieByKist.set(kist, (productieByKist.get(kist) || 0) + prod)
        if (!productieByKistPerLoc.has(kist)) productieByKistPerLoc.set(kist, { genk: 0, wilrijk: 0, willebroek: 0 })
        const ploc = productieByKistPerLoc.get(kist)!
        if (loc.includes('genk')) ploc.genk += prod
        else if (loc.includes('wilrijk')) ploc.wilrijk += prod
        else if (loc.includes('willebroek') || loc === 'wlb' || loc.includes('pac3pl')) ploc.willebroek += prod
      }
    })

    const transferByKist = new Map<string, number>()
    ;(transferRows || []).forEach((row: any) => {
      let kt = row.kistnummer ? String(row.kistnummer).toUpperCase().trim() : ''
      if (kt) { kt = norm(kt); transferByKist.set(kt, (transferByKist.get(kt) || 0) + Number(row.quantity || 0)) }
    })

    const grouped = new Map<string, { case_type: string; total_count: number; oldest_arrival: string | null; has_overdue: boolean }>()
    ;(cases || []).forEach((c: any) => {
      const kt = norm(c.case_type || '')
      if (!grouped.has(kt)) grouped.set(kt, { case_type: kt, total_count: 0, oldest_arrival: null, has_overdue: false })
      const g = grouped.get(kt)!
      g.total_count++
      if (c.arrival_date) {
        const d = String(c.arrival_date).split('T')[0]
        if (!g.oldest_arrival || d < g.oldest_arrival) g.oldest_arrival = d
      }
      if ((c.dagen_te_laat ?? 0) > 0) g.has_overdue = true
    })

    const kRows: any[] = []
    grouped.forEach((data, caseType) => {
      const stockMap = stockByKist.get(caseType) || new Map()
      let stockGenk = 0, stockWB = 0, stockWilrijk = 0
      stockMap.forEach((qty, loc) => {
        if (loc.includes('genk')) stockGenk += qty
        else if (loc.includes('willebroek') || loc === 'wlb' || loc.includes('pac3pl') || loc.includes('items (64)') || loc.includes('items(64)')) stockWB += qty
        else if (loc.includes('wilrijk')) stockWilrijk += qty
      })
      const inProductie = productieByKist.get(caseType) || 0
      const prodPerLoc = productieByKistPerLoc.get(caseType) || { genk: 0, wilrijk: 0, willebroek: 0 }
      const inProductieAndereLoc = productieAndereLocByKist.get(caseType) || 0
      const inTransfer = transferByKist.get(caseType) || 0
      const beschikbaar = stockGenk + stockWB + stockWilrijk + inTransfer
      const tekortTotaal = Math.max(0, data.total_count - beschikbaar)
      const tekort = Math.max(0, tekortTotaal - inProductieAndereLoc)
      const statusRaw =
        tekortTotaal > 0 && beschikbaar === 0 ? 'Leeg'
        : tekortTotaal > 0 ? 'Productie aanmaken'
        : beschikbaar < data.total_count ? 'Gedekt'
        : 'Vol'
      const status = statusRaw === 'Vol' ? 'Ok'
        : statusRaw === 'Leeg' || statusRaw === 'Productie aanmaken'
          ? (inProductie > 0 ? 'In productie leggen' : 'Productie aanmaken en inleggen')
        : statusRaw

      kRows.push({
        case_type: caseType,
        productielocatie: location,
        max_voorraad: data.total_count,
        stock_in_rek: stockWB,
        stock_genk: stockGenk,
        stock_wilrijk: stockWilrijk,
        stock_willebroek: stockWB,
        in_productie: inProductie,
        in_productie_genk: prodPerLoc.genk,
        in_productie_wilrijk: prodPerLoc.wilrijk,
        in_productie_willebroek: prodPerLoc.willebroek,
        in_transfer: inTransfer,
        op_pils: data.total_count,
        tekort,
        status,
        _oldest_arrival: data.oldest_arrival,
        _has_overdue: data.has_overdue,
      })
    })

    // Prioriteit: stock laag eerst, dan overdue, dan langst op PILS (oudste arrival), dan case_type
    kRows.sort((a, b) => {
      const stockA = (a.stock_in_rek ?? 0) + (a.stock_genk ?? 0) + (a.stock_wilrijk ?? 0)
      const stockB = (b.stock_in_rek ?? 0) + (b.stock_genk ?? 0) + (b.stock_wilrijk ?? 0)
      if (stockA !== stockB) return stockA - stockB
      if (a._has_overdue !== b._has_overdue) return a._has_overdue ? -1 : 1
      const da = a._oldest_arrival || '9999-99-99'
      const db = b._oldest_arrival || '9999-99-99'
      if (da !== db) return da.localeCompare(db)
      return String(a.case_type || '').localeCompare(String(b.case_type || ''))
    })
    return kRows.map((r, i) => {
      const { _oldest_arrival, _has_overdue, ...rest } = r
      return { ...rest, priority_rank: i + 1 }
    })
  } catch (err) {
    console.error('fetchKKistenForExcel:', err)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rows, alleenBestellen, location: locParam } = body
    const location = (locParam === 'Wilrijk' ? 'Wilrijk' : 'Genk') as 'Genk' | 'Wilrijk'

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Geen data om te versturen' }, { status: 400 })
    }

    const smtpUser = process.env.SMTP_USER || ''
    const smtpPass = process.env.SMTP_PASSWORD || ''
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP configuratie ontbreekt' }, { status: 500 })
    }

    const keyword = location.toLowerCase()
    const toExport = alleenBestellen
      ? rows.filter((r: any) => r.bestel_aantal > 0)
      : rows
    const locRows = toExport.filter((r: any) =>
      String(r.productielocatie || '').toLowerCase().includes(keyword)
    )

    if (locRows.length === 0) {
      return NextResponse.json({ error: `Geen ${location}-kisten gevonden` }, { status: 400 })
    }

    // Stock server-side ophalen (zelfde logica als kanban-besteladvies) i.p.v. client-data
    const normCase = (x: string) => { const t = String(x || '').trim().toUpperCase(); return t.startsWith('V') ? 'K' + t.substring(1) : t }
    const caseTypes = [...new Set(locRows.map((r: any) => normCase(r.case_type || '')))] as string[]
    const stockByKist = await fetchStockForCKisten(caseTypes)
    const locRowsWithStock = locRows.map((r: any) => {
      const kt = normCase(r.case_type || '')
      const stock = stockByKist.get(kt) || { genk: 0, willebroek: 0, wilrijk: 0 }
      return {
        ...r,
        stock_genk: stock.genk,
        stock_wilrijk: stock.wilrijk,
        stock_in_rek: stock.willebroek,
      }
    })

    const productieAndereLoc = await fetchProductieByLocatie(location === 'Genk' ? 'Wilrijk' : 'Genk')
    const renumbered = locRowsWithStock.map((r: any, i: number) => {
      const kt = normCase(r.case_type || '')
      const inProdOther = productieAndereLoc.get(kt) || 0
      const tekort = Math.max(0, (r.tekort ?? 0) - inProdOther)
      return { ...r, priority_rank: i + 1, tekort }
    })

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]

    const kKisten = await fetchKKistenForExcel(location, productieAndereLoc)

    const wb = buildDailyOrderWorkbook(location, renumbered, today, { kKisten })
    const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
    const filename = `Daily_order_${location}_${dateStr}.xlsx`

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: TO_EMAIL,
      subject: `Dagelijkse order C & K kisten ${location} ${today}`,
      html: `
        <p>Goedemorgen,</p>
        <p>In bijlage status C en K kisten ${location} ${today}</p>
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

    return NextResponse.json({ success: true, message: `E-mail verstuurd naar ${TO_EMAIL} (${location})` })
  } catch (error: any) {
    console.error('Fout bij versturen daily order e-mail:', error)
    return NextResponse.json({ error: error.message || 'Versturen mislukt' }, { status: 500 })
  }
}
