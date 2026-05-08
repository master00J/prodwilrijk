import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { getBcMappingLookup } from '@/lib/bc-mapping/server'

export const dynamic = 'force-dynamic'

/**
 * Diagnostiek: wat staat er in de DB voor een kist/ERP-code?
 * GET /api/grote-inpak/stock-diagnostic?kist=C830
 * of: ?erp=GP006064
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const kistParam = searchParams.get('kist')?.trim()
    const erpParam = searchParams.get('erp')?.trim()
    const kist = kistParam ? kistParam.toUpperCase().replace(/^V/, 'K') : null
    const erp = erpParam?.trim() || null

    if (!kist && !erp) {
      return NextResponse.json({ error: 'Geef ?kist=C830 of ?erp=GP006064' }, { status: 400 })
    }

    // ERP LINK: wat is de koppeling voor dit kist/erp?
    let erpLinkQuery = supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('id, kistnummer, erp_code, productielocatie')
    if (kist) {
      const vKist = kist.replace(/^K/, 'V')
      erpLinkQuery = erpLinkQuery.or(`kistnummer.eq.${kist},kistnummer.eq.${vKist}`)
    } else if (erp) {
      const erpNormOne = normalizeErpCode(erp)
      const bcMapping = await getBcMappingLookup()
      const variantSet = new Set<string>()
      for (const c of [erp, erpNormOne, erpNormOne ? bcMapping.toOld(erpNormOne) : null, erpNormOne ? bcMapping.toNew(erpNormOne) : null]) {
        const x = c ? String(c).trim() : ''
        if (x) variantSet.add(x)
      }
      const variants = [...variantSet]
      erpLinkQuery =
        variants.length <= 1
          ? erpLinkQuery.eq('erp_code', variants[0] || erp)
          : erpLinkQuery.or(variants.map((c) => `erp_code.eq.${c}`).join(','))
    }
    let { data: erpLinkRows } = await erpLinkQuery

    const erpFromLink = erpLinkRows?.[0]?.erp_code
    let kistFromLink = erpLinkRows?.[0]?.kistnummer
    const erpNorm = normalizeErpCode(erp || erpFromLink)

    // Stock: alle rijen die mogelijk bij deze kist horen (op basis van erp_code of kistnummer)
    const searchCodes = new Set<string>()
    if (erpNorm) searchCodes.add(erpNorm)
    if (erp) searchCodes.add(normalizeErpCode(erp) || erp)
    if (erpFromLink) searchCodes.add(normalizeErpCode(erpFromLink) || '')
    if (/^\d{4,6}$/.test(erp || '')) searchCodes.add(erp!)
    if (erpNorm && /^GP\d+$/i.test(erpNorm)) {
      const num = parseInt(erpNorm.replace(/^GP/i, ''), 10)
      if (!isNaN(num)) searchCodes.add(String(num))
    }

    const { data: stockAll } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, location, quantity, productie, bc_source')

    // Als ERP LINK niet matchte op FP maar stock wel een kist heeft: toon link via kistnummer (vaak staat ERP LINK nog op GP).
    if ((!erpLinkRows || erpLinkRows.length === 0) && erp && erpNorm) {
      const kn = (stockAll || []).find((s: any) => normalizeErpCode(String(s.erp_code || '')) === erpNorm)?.kistnummer
      if (kn) {
        const kNorm = String(kn).toUpperCase().replace(/^V/, 'K')
        const vK = kNorm.replace(/^K/, 'V')
        const { data: byKist } = await supabaseAdmin
          .from('grote_inpak_erp_link')
          .select('id, kistnummer, erp_code, productielocatie')
          .or(`kistnummer.eq.${kNorm},kistnummer.eq.${vK}`)
        if (byKist?.length) {
          erpLinkRows = byKist
          kistFromLink = byKist[0]?.kistnummer ?? kistFromLink
        }
      }
    }

    const kistForMatch = kist || kistFromLink
    const relevantStock = (stockAll || []).filter((s: any) => {
      const ec = String(s.erp_code || '').trim()
      const kn = String(s.kistnummer || '').toUpperCase().replace(/^V/, 'K')
      if (kistForMatch && kn === kistForMatch.replace(/^V/, 'K')) return true
      if (erpNorm && normalizeErpCode(ec) === erpNorm) return true
      if (searchCodes.has(ec)) return true
      if (searchCodes.has(normalizeErpCode(ec) || '')) return true
      const num = parseInt(ec.replace(/^GP/i, ''), 10)
      if (!isNaN(num) && searchCodes.has(String(num))) return true
      return false
    })

    const alleLocaties = [...new Set((stockAll || []).map((s: any) => s.location).filter(Boolean))]

    const advies: string[] = []
    for (const s of relevantStock) {
      const q = Number((s as any).quantity ?? 0)
      const p = Number((s as any).productie ?? 0)
      const src = String((s as any).bc_source ?? '')
      if (p > 0 && q === 0 && src === 'legacy') {
        advies.push(
          `${(s as any).location}: bc_source=legacy → voorraad werd bij import op 0 gezet. Upload dit bestand opnieuw met «Nieuwe BC36» (of verwijder legacy-rijen).`,
        )
      }
      if (p > 0 && q === 0 && src === 'bc36') {
        advies.push(
          `${(s as any).location}: bc_source=bc36 maar quantity=0 — controleer of de Excel-kolom «Inventory» correct is herkend bij de laatste upload (serverlogs).`,
        )
      }
    }

    return NextResponse.json({
      kist_gezocht: kist,
      erp_gezocht: erp,
      erp_link: erpLinkRows?.[0] || null,
      erp_link_alle_matches: erpLinkRows?.length ? erpLinkRows : null,
      erp_norm: erpNorm,
      stock_rijen: relevantStock,
      stock_totaal_in_db: stockAll?.length || 0,
      alle_locaties_in_stock: alleLocaties,
      advies: advies.length ? advies : undefined,
      uitleg: {
        erp_link: 'Koppeling in ERP LINK tabel',
        stock_rijen: 'Stock-rijen die aan deze kist/ERP gekoppeld zouden moeten worden',
        productie: 'Kolom J in BC Item List: Qty. on Prod. Order',
        inventory: 'Kolom G: Inventory (= quantity in DB bij BC36-import)',
        bc_source: 'legacy = alleen productie uit file opgeslagen; bc36 = volledige voorraad + productie',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
