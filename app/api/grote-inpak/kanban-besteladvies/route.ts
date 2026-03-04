import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode, normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'
import JSZip from 'jszip'
import { buildDailyOrderWorkbook } from '@/lib/grote-inpak/daily-order-excel'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Haal rekindeling op
    const { data: config, error: configError } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .select('*')
      .eq('actief', true)
      .order('verbruik_per_dag', { ascending: false })

    if (configError) throw configError

    // 1b. Verbruik/dag uit packed-data (laatste 30 dagen): gemiddeld aantal gepakte kisten per dag per case_type
    const packedFrom = new Date()
    packedFrom.setDate(packedFrom.getDate() - 30)
    const packedFromStr = packedFrom.toISOString().split('T')[0]
    const { data: packedRaw } = await supabaseAdmin
      .from('grote_inpak_packed')
      .select('case_type, packed_date')
      .gte('packed_date', packedFromStr)
    const verbruikPerDagByKist = new Map<string, number>()
    const totalByCase = new Map<string, number>()
    ;(packedRaw || []).forEach((p: any) => {
      const kist = String(p.case_type || '').toUpperCase().trim()
      if (!kist) return
      totalByCase.set(kist, (totalByCase.get(kist) || 0) + 1)
    })
    const dagenInPeriode = 30
    totalByCase.forEach((totaal, kist) => {
      verbruikPerDagByKist.set(kist, Math.round((totaal / dagenInPeriode) * 100) / 100)
    })

    // 1c. Transfer orders: kisten onderweg naar Willebroek (kistnummer al gematcht bij upload via ERP LINK)
    const { data: transferRaw } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('erp_code, kistnummer, quantity')

    // 2. Haal stock op (alle locaties, incl. productie = Qty. on Prod. Order)
    const { data: stockRaw, error: stockError } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, location, quantity, productie, item_number')

    if (stockError) throw stockError

    // 3. ERP LINK voor kistnummer → erp_code mapping
    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const kistToErp = new Map<string, string>()
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.kistnummer && e.erp_code) {
        const kist = normalizeKistnummer(e.kistnummer)
        const erpNorm = normalizeErpCode(e.erp_code)
        if (erpNorm) {
          kistToErp.set(kist, erpNorm)
          erpToKist.set(erpNorm, kist)
        }
      }
    })

    // 3b. Cases-tabel: erp_code → case_type (fallback) + aantal op PILS + oudste PILS-datum per kisttype
    const { data: casesLink } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, erp_code, case_type, arrival_date')
    const erpToCaseType = new Map<string, string>()
    const pilsByKist = new Map<string, number>()
    const oldestPilsDateByKist = new Map<string, string>()  // case_type → oudste arrival_date (YYYY-MM-DD)
    ;(casesLink || []).forEach((c: any) => {
      const caseType = c.case_type ? normalizeKistnummer(c.case_type) : null
      if (c.erp_code && caseType) {
        const erpNorm = normalizeErpCode(c.erp_code)
        if (erpNorm) erpToCaseType.set(erpNorm, caseType)
      }
      if (caseType) {
        pilsByKist.set(caseType, (pilsByKist.get(caseType) || 0) + 1)
        const dateRaw = c.arrival_date ? String(c.arrival_date).split('T')[0] : null
        if (dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
          const current = oldestPilsDateByKist.get(caseType)
          if (!current || dateRaw < current) oldestPilsDateByKist.set(caseType, dateRaw)
        }
      }
    })

    // 3c. Bouw transferByKist map — kistnummer al bepaald bij upload
    const transferByKist = new Map<string, number>()
    ;(transferRaw || []).forEach((t: any) => {
      const kist = t.kistnummer ? String(t.kistnummer).toUpperCase().trim() : null
      const qty = Number(t.quantity || 0)
      if (!kist || qty <= 0) return
      transferByKist.set(kist, (transferByKist.get(kist) || 0) + qty)
    })

    // 4. Bouw stockmap per kistnummer per locatie (quantity + productie = Qty. on Prod. Order)
    const stockByKist = new Map<string, {
      genk: number
      willebroek: number
      wilrijk: number
      totaal: number
      in_productie: number  // som van alle locaties (Genk + Willebroek + Wilrijk)
    }>()

    ;(stockRaw || []).forEach((s: any) => {
      let kist = s.kistnummer ? normalizeKistnummer(s.kistnummer) : null
      const erpRaw = s.erp_code ? String(s.erp_code).trim() : ''
      const erpNorm = erpRaw ? normalizeErpCode(erpRaw) : null
      const itemNo = s.item_number ? String(s.item_number).toUpperCase().trim() : ''
      // 1. Via ERP LINK tabel
      if (!kist && erpNorm) kist = erpToKist.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToKist.get(normalizeErpCode(itemNo) || itemNo) || null
      // 2. Fallback: via cases-tabel
      if (!kist && erpNorm) kist = erpToCaseType.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToCaseType.get(normalizeErpCode(itemNo) || itemNo) || null
      // 3. Als de erp_code zelf al een C-code is (K-kisten zijn aparte types, niet converteren)
      if (!kist && erpNorm && /^C\d+/.test(erpNorm)) kist = erpNorm
      if (!kist && itemNo && /^C\d+/.test(itemNo)) kist = itemNo
      if (!kist) return

      const loc = String(s.location || '').toLowerCase()
      const qty = Math.max(0, Number(s.quantity || 0))
      const productie = Math.max(0, Number(s.productie || 0))

      if (!stockByKist.has(kist)) {
        stockByKist.set(kist, { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0, in_productie: 0 })
      }
      const entry = stockByKist.get(kist)!
      if (loc.includes('genk')) {
        entry.genk += qty
      } else if (loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl')) {
        entry.willebroek += qty
      } else if (loc.includes('wilrijk')) {
        entry.wilrijk += qty
      }
      entry.totaal += qty
      // In productie = som van Qty. on Prod. Order over alle locaties
      entry.in_productie += productie
    })

    // 5. Combineer config met stock en bereken besteladvies
    const result = (config || []).map((row: any) => {
      const kt = normalizeKistnummer(row.case_type)
      const stapelsPerPos = row.stapels_per_pos || 2
      const maxVoorraad = row.posities * row.stapel * stapelsPerPos
      // Trigger = zodra 1 item verbruikt is → 1 stapel aanmaken (echte kanban logica)
      const bestelpunt = maxVoorraad

      const stock = stockByKist.get(kt) || { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0, in_productie: 0 }
      const stockInRek = stock.willebroek
      const stockElders = (stock.genk ?? 0) + (stock.wilrijk ?? 0) // beschikbaar maar nog niet in rek
      const inProductie = stock.in_productie ?? 0
      const opPils = pilsByKist.get(kt) || 0
      const inTransfer = transferByKist.get(kt) || 0
      // Tekort = wat er fysiek in de rek ontbreekt (status van de rek)
      const tekort = Math.max(0, maxVoorraad - stockInRek)
      // Effectief te produceren = tekort minus wat al fysiek bestaat of onderweg is
      // "In productie" = order aangemaakt, NIET al geproduceerd → telt niet mee als beschikbaar
      const stockNaPils = stockInRek - opPils
      const effectiefTekort = Math.max(0, maxVoorraad - stockNaPils - stockElders - inTransfer)
      const bestelAantal = effectiefTekort > 0 ? Math.ceil(effectiefTekort / row.stapel) * row.stapel : 0

      const oudstePils = oldestPilsDateByKist.get(kt) || null

      // Status = enkel "Productie aanmaken" / "Leeg" als bestelAantal > 0, anders "Gedekt" of "Vol"
      const statusLabel =
        bestelAantal > 0 && stockInRek === 0 ? 'Leeg'
        : bestelAantal > 0                   ? 'Productie aanmaken'
        : stockInRek < maxVoorraad           ? 'Gedekt'
        : 'Vol'

      const priorityTier =
        bestelAantal > 0 && stockInRek === 0 ? 1
        : bestelAantal > 0                   ? 2
        : stockInRek === 0                   ? 3
        : stockInRek < maxVoorraad           ? 4
        : 5

      return {
        id: row.id,
        case_type: kt,
        rek_sectie: row.rek_sectie,
        rek_niveau: row.rek_niveau,
        rek_kolom: row.rek_kolom,
        productielocatie: row.productielocatie,
        stapel: row.stapel,
        posities: row.posities,
        stapels_per_pos: stapelsPerPos,
        max_voorraad: maxVoorraad,
        bestelpunt,
        verbruik_per_dag: verbruikPerDagByKist.has(kt) ? verbruikPerDagByKist.get(kt)! : row.verbruik_per_dag,
        prioriteit: row.prioriteit,
        notitie: row.notitie,
        stock_genk: stock.genk,
        stock_willebroek: stock.willebroek,
        stock_wilrijk: stock.wilrijk,
        stock_totaal: stock.totaal,
        stock_in_rek: stockInRek,
        stock_elders: stockElders,
        in_productie: inProductie,
        in_transfer: inTransfer,
        op_pils: opPils,
        tekort,
        bestel_aantal: bestelAantal,
        status: statusLabel,
        oldest_pils_date: oudstePils,
        _priority_tier: priorityTier,
        _tekort: tekort,
      }
    })

    // Sorteer: tier eerst, dan stock in rek laag → hoog (bijna leeg = urgenter), dan tekort aflopend, dan oudste PILS
    const sorted = (result as any[]).sort((a, b) => {
      if (a._priority_tier !== b._priority_tier) return a._priority_tier - b._priority_tier
      if (a.stock_in_rek !== b.stock_in_rek) return a.stock_in_rek - b.stock_in_rek // Lager stock = urgenter
      if (b._tekort !== a._tekort) return b._tekort - a._tekort
      const dateA = a.oldest_pils_date || '9999-99-99'
      const dateB = b.oldest_pils_date || '9999-99-99'
      return dateA.localeCompare(dateB)
    })
    sorted.forEach((row: any, idx: number) => {
      row.priority_rank = idx + 1
      delete row._priority_tier
      delete row._tekort
    })

    // Diagnostiek
    const erpLinkCount = (erpLink || []).length
    const totalStockRows = (stockRaw || []).length

    // Unieke locaties in de stocktabel ophalen voor diagnose
    const uniqueLocations = [...new Set((stockRaw || []).map((s: any) => s.location).filter(Boolean))]

    const kistenMetWillebroekStock = Array.from(stockByKist.entries())
      .filter(([, v]) => v.willebroek > 0).map(([k]) => k)
    const kistenZonderWillebroek = Array.from(stockByKist.entries())
      .filter(([, v]) => v.willebroek === 0 && v.totaal > 0).map(([k]) => k)
    const kistenMetProductie = Array.from(stockByKist.entries())
      .filter(([, v]) => v.in_productie > 0).map(([k, v]) => `${k}:${v.in_productie}`)

    let warning: string | null = null
    if (erpLinkCount === 0) {
      warning = 'ERP LINK tabel is leeg. Voeg GP-code → C-kist koppelingen toe via het ERP LINK tabblad.'
    } else if (stockByKist.size === 0) {
      warning = `ERP LINK heeft ${erpLinkCount} entries maar geen enkele stock-rij kon gekoppeld worden. Controleer of de GP-codes in de stock files overeenkomen met de ERP-codes in ERP LINK.`
    } else if (kistenMetWillebroekStock.length === 0 && kistenZonderWillebroek.length > 0) {
      const locStr = uniqueLocations.join(', ')
      warning = `Stock gevonden voor ${kistenZonderWillebroek.length} kisttype(n) maar 0 in Willebroek. Locaties in database: [${locStr}]. Upload "Stock Willebroek.xlsx" (bestandsnaam moet "willebroek" bevatten).`
    }

    return NextResponse.json({
      data: sorted,
      _debug: {
        erp_link_entries: erpLinkCount,
        stock_rows_total: totalStockRows,
        stock_kisten_matched: stockByKist.size,
        stock_locaties_in_db: uniqueLocations,
        kisten_met_willebroek_stock: kistenMetWillebroekStock.length,
        kisten_zonder_willebroek: kistenZonderWillebroek.slice(0, 10),
        kisten_met_productie: kistenMetProductie.slice(0, 10),
        warning,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Genereer 2 aparte Excel-bestanden (Genk + Wilrijk) in één ZIP — C kisten daily order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data: rows, alleenBestellen } = body

    const toExport = alleenBestellen
      ? (rows || []).filter((r: any) => r.bestel_aantal > 0)
      : (rows || [])

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]

    const locGenk = (loc: string) => String(loc || '').toLowerCase().includes('genk')
    const locWilrijk = (loc: string) => String(loc || '').toLowerCase().includes('wilrijk')
    const genkRows = toExport.filter((r: any) => locGenk(r.productielocatie))
    const wilrijkRows = toExport.filter((r: any) => locWilrijk(r.productielocatie))

    // Hernummer per locatie zodat elke Excel begint bij 1, 2, 3...
    const renumber = (rows: any[]) => rows.map((r, i) => ({ ...r, priority_rank: i + 1 }))
    const wbGenk = buildDailyOrderWorkbook('Genk', renumber(genkRows), today)
    const wbWilrijk = buildDailyOrderWorkbook('Wilrijk', renumber(wilrijkRows), today)

    const bufGenk = await wbGenk.xlsx.writeBuffer() as ArrayBuffer
    const bufWilrijk = await wbWilrijk.xlsx.writeBuffer() as ArrayBuffer

    const zip = new JSZip()
    zip.file(`C_kisten_daily_order_Genk_${dateStr}.xlsx`, bufGenk)
    zip.file(`C_kisten_daily_order_Wilrijk_${dateStr}.xlsx`, bufWilrijk)

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="C_kisten_daily_order_Genk_Wilrijk_${dateStr}.zip"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
