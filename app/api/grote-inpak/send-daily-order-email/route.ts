import { NextRequest, NextResponse } from 'next/server'
import {
  buildCombinedDailyOrderWorkbook,
  buildDailyOrderWorkbook,
  type DailyOrderLocationOptions,
} from '@/lib/grote-inpak/daily-order-excel'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode, normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'
import { getEndingDatesByKist } from '@/lib/grote-inpak/production-orders'
import {
  enrichRowWithBouwpakketStock,
  fetchBouwpakketStockContext,
  type BouwpakketStockContext,
} from '@/lib/grote-inpak/bouwpakket-stock'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Speciale C-kisten die op het K-tabblad verschijnen (geen standaard voorraadkisten)
const SPECIALE_C_KISTEN = ['C791', 'C792', 'C794', 'C795', 'C796']

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
      else if (loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl')) e.willebroek += qty
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
        kist = normalizeKistnummer(kist)
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
    const specialeFilter = SPECIALE_C_KISTEN.map(ct => `case_type.eq.${ct}`).join(',')
    const { data: cases } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date, erp_code, stapel, dagen_te_laat, bc_fp_item_no')
      .or(`case_type.ilike.K%,case_type.ilike.V%,${specialeFilter}`)
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
        if (erpNorm) erpToKist.set(erpNorm, normalizeKistnummer(String(e.kistnummer).trim()))
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

    // Forecast data ophalen om te detecteren welke PILS cases niet op de forecast stonden
    const allCaseLabels = (cases || []).map((c: any) => c.case_label).filter(Boolean)
    const { data: forecastRows } = allCaseLabels.length > 0
      ? await supabaseAdmin.from('grote_inpak_forecast').select('case_label, case_type, arrival_date').in('case_label', allCaseLabels)
      : { data: [] as any[] }
    const forecastByLabel = new Map<string, string>()
    ;(forecastRows || []).forEach((f: any) => {
      if (f.case_label) forecastByLabel.set(f.case_label, f.arrival_date || '')
    })

    const grouped = new Map<
      string,
      {
        case_type: string
        total_count: number
        oldest_arrival: string | null
        has_overdue: boolean
        notOnForecast: number
        forecastDates: string[]
        fpCodes: Set<string>
      }
    >()
    ;(cases || []).forEach((c: any) => {
      const kt = norm(c.case_type || '')
      if (!grouped.has(kt))
        grouped.set(kt, {
          case_type: kt,
          total_count: 0,
          oldest_arrival: null,
          has_overdue: false,
          notOnForecast: 0,
          forecastDates: [],
          fpCodes: new Set(),
        })
      const g = grouped.get(kt)!
      g.total_count++
      const fpRaw = (c.bc_fp_item_no || c.erp_code || '').trim()
      if (fpRaw) g.fpCodes.add(String(fpRaw).toUpperCase())
      if (c.arrival_date) {
        const d = String(c.arrival_date).split('T')[0]
        if (!g.oldest_arrival || d < g.oldest_arrival) g.oldest_arrival = d
      }
      if ((c.dagen_te_laat ?? 0) > 0) g.has_overdue = true
      if (!forecastByLabel.has(c.case_label)) {
        g.notOnForecast++
      } else {
        const fcDate = forecastByLabel.get(c.case_label)
        if (fcDate) g.forecastDates.push(fcDate)
      }
    })

    const kRows: any[] = []
    grouped.forEach((data, caseType) => {
      const stockMap = stockByKist.get(caseType) || new Map()
      let stockGenk = 0, stockWB = 0, stockWilrijk = 0
      stockMap.forEach((qty, loc) => {
        if (loc.includes('genk')) stockGenk += qty
        else if (loc.includes('willebroek') || loc === 'wlb' || loc.includes('pac3pl')) stockWB += qty
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
      let status = statusRaw
      if (statusRaw === 'Vol') status = 'Ok'
      else if (statusRaw === 'Leeg' || statusRaw === 'Productie aanmaken') {
        if (tekort === 0 && inProductieAndereLoc > 0) {
          status = location === 'Genk' ? 'In productie Wilrijk' : 'In productie Genk'
        } else if (inProductie >= tekortTotaal) {
          status = 'In productie leggen'
        } else {
          status = 'Productie aanmaken en inleggen'
        }
      }

      const infoParts: string[] = []
      if (data.notOnForecast > 0) {
        infoParts.push(data.notOnForecast === data.total_count
          ? 'Niet op Forecast gekomen'
          : `${data.notOnForecast}x niet op forecast`)
      }
      if (data.forecastDates.length > 0) {
        const fmtDt = (iso: string) => {
          const d = new Date(iso)
          if (isNaN(d.getTime())) return null
          return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        }
        const uniqueDates = [...new Set(data.forecastDates.map((d: string) => d.split('T')[0]))].sort()
        const formatted = uniqueDates.map(fmtDt).filter(Boolean)
        if (formatted.length === 1) {
          infoParts.push(`Forecast datum ${formatted[0]}`)
        } else if (formatted.length > 1) {
          infoParts.push(`Forecast ${formatted.join(', ')}`)
        }
      }

      kRows.push({
        case_type: caseType,
        bc_fp: [...data.fpCodes].sort().join(', ') || '—',
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
        info: infoParts.join(', ') || '',
        _oldest_arrival: data.oldest_arrival,
        _has_overdue: data.has_overdue,
      })
    })

    // Sortering K-kisten:
    // 1. Eerst actie nodig (tekort > 0), dan overige, dan "in productie andere loc", dan Ok
    // 2. Binnen elke groep: oudste PILS-unit eerst (oudste arrival_date bovenaan)
    const tier = (r: any) => {
      if (r.tekort > 0) return 0
      if (r.status === 'In productie Wilrijk' || r.status === 'In productie Genk') return 2
      if (r.status === 'Ok') return 3
      return 1
    }
    kRows.sort((a, b) => {
      const ta = tier(a)
      const tb = tier(b)
      if (ta !== tb) return ta - tb

      const da = a._oldest_arrival || '9999-99-99'
      const db = b._oldest_arrival || '9999-99-99'
      if (da !== db) return da.localeCompare(db)

      if (ta === 0) {
        if (a._has_overdue !== b._has_overdue) return a._has_overdue ? -1 : 1
        if (a.tekort !== b.tekort) return b.tekort - a.tekort
      }

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

async function fetchOverdueKisten(location: 'Genk' | 'Wilrijk'): Promise<any[]> {
  try {
    const { data: cases } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date, deadline, dagen_te_laat, productielocatie')
      .eq('productielocatie', location)
      .gt('dagen_te_laat', 0)
      .order('dagen_te_laat', { ascending: false })

    if (!cases || cases.length === 0) return []

    const caseLabels = cases.map((c: any) => c.case_label).filter(Boolean)

    // Stock per case_type ophalen om gedekte kisten uit te filteren
    const caseTypes = [...new Set(cases.map((c: any) => normalizeKistnummer(c.case_type || '')))]
    const { data: stockRaw } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('kistnummer, quantity')
    const stockByCaseType = new Map<string, number>()
    ;(stockRaw || []).forEach((s: any) => {
      if (!s.kistnummer) return
      const kt = normalizeKistnummer(s.kistnummer)
      if (caseTypes.includes(kt)) {
        stockByCaseType.set(kt, (stockByCaseType.get(kt) || 0) + Math.max(0, Number(s.quantity || 0)))
      }
    })

    // Overdue-count per case_type
    const overdueCountByCaseType = new Map<string, number>()
    cases.forEach((c: any) => {
      const kt = normalizeKistnummer(c.case_type || '')
      overdueCountByCaseType.set(kt, (overdueCountByCaseType.get(kt) || 0) + 1)
    })

    // Alle forecast-wijzigingen voor deze case labels (date_change voor verschuivingen)
    const { data: allChanges } = await supabaseAdmin
      .from('grote_inpak_forecast_changes')
      .select('case_label, change_type, changed_at, new_arrival_date')
      .in('case_label', caseLabels)
      .in('change_type', ['added', 'date_change'])
      .order('changed_at', { ascending: true })

    // Huidige forecast datum per case label
    const { data: forecastRows } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .select('case_label, arrival_date')
      .in('case_label', caseLabels)

    const eersteGeplandeDatum = new Map<string, string>()
    const aantalVerschuivingen = new Map<string, number>()
    const huidigeForecastDatum = new Map<string, string>()

    ;(allChanges || []).forEach((ch: any) => {
      const label = ch.case_label
      if (!label) return
      if (ch.change_type === 'added' && !eersteGeplandeDatum.has(label)) {
        if (ch.new_arrival_date) eersteGeplandeDatum.set(label, ch.new_arrival_date)
      }
      if (ch.change_type === 'date_change') {
        aantalVerschuivingen.set(label, (aantalVerschuivingen.get(label) || 0) + 1)
      }
    })

    ;(forecastRows || []).forEach((f: any) => {
      if (f.case_label && f.arrival_date) huidigeForecastDatum.set(f.case_label, f.arrival_date)
    })

    // Filter kisten die gedekt zijn door stock (stock >= overdue count voor dat type)
    const filtered = cases.filter((c: any) => {
      const kt = normalizeKistnummer(c.case_type || '')
      const stock = stockByCaseType.get(kt) || 0
      const overdue = overdueCountByCaseType.get(kt) || 1
      return stock < overdue
    })

    return filtered.map((c: any) => ({
      ...c,
      eerste_geplande_datum: eersteGeplandeDatum.get(c.case_label) || null,
      huidige_forecast_datum: huidigeForecastDatum.get(c.case_label) || null,
      aantal_verschuivingen: aantalVerschuivingen.get(c.case_label) || 0,
    }))
  } catch (err) {
    console.error('fetchOverdueKisten:', err)
    return []
  }
}

type DailyOrderLocation = 'Genk' | 'Wilrijk'

function isCKistRow(r: any) {
  const ct = String(r.case_type || '').trim().toUpperCase()
  return ct.startsWith('C') && !SPECIALE_C_KISTEN.includes(ct)
}

function locationHasExportData(cRows: any[], kKisten: any[], overdueKisten: any[]) {
  return cRows.length > 0 || kKisten.length > 0 || overdueKisten.length > 0
}

async function buildLocationDailyOrderPayload(
  rows: any[],
  location: DailyOrderLocation,
  alleenBestellen: boolean,
  bouwpakketCtx: BouwpakketStockContext
): Promise<{ data: any[]; options: DailyOrderLocationOptions }> {
  const keyword = location.toLowerCase()
  const toExport = alleenBestellen ? rows.filter((r: any) => r.bestel_aantal > 0) : rows
  const locRows = toExport
    .filter(isCKistRow)
    .filter((r: any) => String(r.productielocatie || '').toLowerCase().includes(keyword))

  const normCase = (x: string) => normalizeKistnummer(String(x || '').trim())
  const caseTypes = [...new Set(locRows.map((r: any) => normCase(r.case_type || '')))] as string[]
  const stockByKist = await fetchStockForCKisten(caseTypes)
  const locRowsWithStock = locRows.map((r: any) => {
    const kt = normCase(r.case_type || '')
    const stock = stockByKist.get(kt) || { genk: 0, willebroek: 0, wilrijk: 0 }
    return enrichRowWithBouwpakketStock(
      {
        ...r,
        stock_genk: stock.genk,
        stock_wilrijk: stock.wilrijk,
        stock_in_rek: stock.willebroek,
      },
      bouwpakketCtx
    )
  })

  const productieAndereLoc = await fetchProductieByLocatie(location === 'Genk' ? 'Wilrijk' : 'Genk')
  const renumbered = locRowsWithStock.map((r: any, i: number) => {
    const kt = normCase(r.case_type || '')
    const inProdOther = productieAndereLoc.get(kt) || 0
    const tekort = Math.max(0, (r.tekort ?? 0) - inProdOther)
    return { ...r, priority_rank: i + 1, tekort }
  })

  const kKistenRaw = await fetchKKistenForExcel(location, productieAndereLoc)
  const kKisten = kKistenRaw.map((r) => enrichRowWithBouwpakketStock(r, bouwpakketCtx))
  const overdueKisten = await fetchOverdueKisten(location)

  return {
    data: renumbered,
    options: { kKisten, overdueKisten },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rows, alleenBestellen, location: locParam } = body
    const isCombined = locParam === 'both' || locParam === 'Alle' || locParam === 'all'

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Geen data om te downloaden' }, { status: 400 })
    }

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]
    const [endingDatesByKist, bouwpakketCtx] = await Promise.all([
      getEndingDatesByKist(),
      fetchBouwpakketStockContext(),
    ])

    if (isCombined) {
      const [genkPayload, wilrijkPayload] = await Promise.all([
        buildLocationDailyOrderPayload(rows, 'Genk', alleenBestellen, bouwpakketCtx),
        buildLocationDailyOrderPayload(rows, 'Wilrijk', alleenBestellen, bouwpakketCtx),
      ])

      const genkHasData = locationHasExportData(
        genkPayload.data,
        genkPayload.options.kKisten || [],
        genkPayload.options.overdueKisten || []
      )
      const wilrijkHasData = locationHasExportData(
        wilrijkPayload.data,
        wilrijkPayload.options.kKisten || [],
        wilrijkPayload.options.overdueKisten || []
      )

      if (!genkHasData && !wilrijkHasData) {
        return NextResponse.json({ error: 'Geen Genk- of Wilrijk-kisten gevonden' }, { status: 400 })
      }

      genkPayload.options.endingDatesByKist = endingDatesByKist
      wilrijkPayload.options.endingDatesByKist = endingDatesByKist

      const wb = buildCombinedDailyOrderWorkbook(genkPayload, wilrijkPayload, today)
      const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
      const filename = `Daily_order_Genk_Wilrijk_${dateStr}.xlsx`

      return new Response(Buffer.from(buffer) as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const location = (locParam === 'Wilrijk' ? 'Wilrijk' : 'Genk') as DailyOrderLocation
    const payload = await buildLocationDailyOrderPayload(rows, location, alleenBestellen, bouwpakketCtx)

    if (
      !locationHasExportData(
        payload.data,
        payload.options.kKisten || [],
        payload.options.overdueKisten || []
      )
    ) {
      return NextResponse.json({ error: `Geen ${location}-kisten gevonden` }, { status: 400 })
    }

    payload.options.endingDatesByKist = endingDatesByKist

    const wb = buildDailyOrderWorkbook(location, payload.data, today, payload.options)
    const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer
    const filename = `Daily_order_${location}_${dateStr}.xlsx`

    return new Response(Buffer.from(buffer) as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Fout bij genereren daily order excel:', error)
    return NextResponse.json({ error: error.message || 'Genereren mislukt' }, { status: 500 })
  }
}
