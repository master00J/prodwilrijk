import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'

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
      const erpNorm = normalizeErpCode(erp)
      const allCodes = [...new Set([erp, erpNorm].filter(Boolean) as string[])]
      if (allCodes.length === 1) {
        erpLinkQuery = erpLinkQuery.eq('erp_code', allCodes[0])
      } else {
        erpLinkQuery = erpLinkQuery.or(allCodes.map(c => `erp_code.eq.${c}`).join(','))
      }
    }
    const { data: erpLinkRows } = await erpLinkQuery

    const erpFromLink = erpLinkRows?.[0]?.erp_code
    const kistFromLink = erpLinkRows?.[0]?.kistnummer
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
      .select('erp_code, kistnummer, location, quantity, productie')

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

    return NextResponse.json({
      kist_gezocht: kist,
      erp_gezocht: erp,
      erp_link: erpLinkRows?.[0] || null,
      erp_norm: erpNorm,
      stock_rijen: relevantStock,
      stock_totaal_in_db: stockAll?.length || 0,
      alle_locaties_in_stock: alleLocaties,
      uitleg: {
        erp_link: 'Koppeling in ERP LINK tabel',
        stock_rijen: 'Stock-rijen die aan deze kist/ERP gekoppeld zouden moeten worden',
        productie: 'Kolom K uit Stock Excel (Qty. on Prod. Order)',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
