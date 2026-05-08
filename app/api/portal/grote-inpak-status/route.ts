import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import {
  groteInpakFpMatchKey,
  groupActiveProductionLogsByFp,
  type ProductionTimeActiveSummary,
} from '@/lib/grote-inpak/production-time-floor'

export const dynamic = 'force-dynamic'

function buildPortalProgress(
  row: {
    productielocatie?: string | null
    in_willebroek?: boolean | null
  },
  prod: ProductionTimeActiveSummary | null,
): { headline: string; detail: string | null; production_step: string | null; production_order_no: string | null } {
  if (prod) {
    return {
      headline: 'In productie op de vloer',
      detail: `Huidige stap: ${prod.step}`,
      production_step: prod.step,
      production_order_no: prod.production_order_number || null,
    }
  }
  if (row.in_willebroek) {
    return {
      headline: 'In ons magazijn (Willebroek)',
      detail: 'Uw order is klaar voor verdere verwerking of afhaling volgens afspraak.',
      production_step: null,
      production_order_no: null,
    }
  }
  const loc = String(row.productielocatie || '').trim()
  if (loc === 'Genk') {
    return {
      headline: 'In voorbereiding (Genk)',
      detail: 'Uw kist wordt klaargemaakt voor transport of productie.',
      production_step: null,
      production_order_no: null,
    }
  }
  if (loc === 'Wilrijk') {
    return {
      headline: 'In voorbereiding (Wilrijk)',
      detail: null,
      production_step: null,
      production_order_no: null,
    }
  }
  return {
    headline: 'Order geregistreerd',
    detail: 'De planning wordt opgevolgd. Neem bij vragen contact op met uw verkoper.',
    production_step: null,
    production_order_no: null,
  }
}

const CASE_SELECT =
  'case_label, case_type, productielocatie, in_willebroek, arrival_date, deadline, dagen_te_laat, bc_line_description, bc_fp_item_no, bc_shop_order_no, pils_shop_order_key, serial_number'

/**
 * Publieke statuslookup — klant vult enkel **shopordernummer** (zoals op orderbevestiging / BC shop order).
 * Body: { shopOrder: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawInput = String(body.shopOrder ?? body.shop_order ?? '').trim()

    const key = shopOrderMatchKey(rawInput || undefined)
    if (!key) {
      return NextResponse.json(
        { error: 'Vul het shopordernummer in (de code uit uw orderbevestiging).' },
        { status: 400 },
      )
    }

    const notFoundMsg =
      'We vinden geen actuele status voor dit nummer. Controleer de invoer of neem contact op met uw contactpersoon.'

    let { data: rows, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select(CASE_SELECT)
      .eq('pils_shop_order_key', key)

    if (error) throw error

    if (!rows || rows.length === 0) {
      const tries = [...new Set([rawInput.replace(/\D/g, ''), key].filter((s) => s.length > 0))]
      for (const t of tries) {
        const { data: hit, error: e2 } = await supabaseAdmin
          .from('grote_inpak_cases')
          .select(CASE_SELECT)
          .eq('bc_shop_order_no', t)
        if (e2) throw e2
        if (hit?.length) {
          rows = hit
          break
        }
      }
    }

    if (!rows || rows.length === 0) {
      /* laatste poging: exact pils_shop_order_key al gedaan; match ruwe suffix-only invoer op bc_shop_order_no via normalisatie */
      const digitsOnly = rawInput.replace(/\D/g, '')
      if (digitsOnly.length >= 6) {
        const suffixKey = shopOrderMatchKey(digitsOnly)
        if (suffixKey && suffixKey !== key) {
          const { data: hit3, error: e3 } = await supabaseAdmin
            .from('grote_inpak_cases')
            .select(CASE_SELECT)
            .eq('pils_shop_order_key', suffixKey)
          if (e3) throw e3
          if (hit3?.length) rows = hit3
        }
      }
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: notFoundMsg }, { status: 404 })
    }

    const cases = rows as any[]

    let floorByFp = new Map<string, ProductionTimeActiveSummary>()
    const needFp = cases.some((c) => c.bc_fp_item_no)
    if (needFp) {
      const { data: activeLogs, error: logErr } = await supabaseAdmin
        .from('time_logs')
        .select('employee_id, production_item_number, production_step, production_order_number, start_time')
        .is('end_time', null)
        .eq('type', 'production_order')

      if (!logErr && activeLogs?.length) {
        const empIds = [...new Set(activeLogs.map((l: any) => l.employee_id).filter(Boolean))]
        const { data: emps } = await supabaseAdmin.from('employees').select('id, name').in('id', empIds)
        const empMap = new Map<number, string>()
        ;(emps || []).forEach((e: any) => empMap.set(Number(e.id), String(e.name || '')))
        floorByFp = groupActiveProductionLogsByFp(activeLogs as any, empMap)
      }
    }

    const lines = cases.map((row) => {
      const fpKey = row.bc_fp_item_no ? groteInpakFpMatchKey(row.bc_fp_item_no) : null
      const prod = fpKey ? floorByFp.get(fpKey) ?? null : null
      const progress = buildPortalProgress(row, prod)
      return {
        case_label: row.case_label,
        case_type: row.case_type ?? null,
        productielocatie: row.productielocatie ?? null,
        in_willebroek: Boolean(row.in_willebroek),
        arrival_indicative: row.arrival_date ?? null,
        deadline: row.deadline ?? null,
        days_overdue: typeof row.dagen_te_laat === 'number' ? row.dagen_te_laat : 0,
        description: row.bc_line_description ?? null,
        fp_code: row.bc_fp_item_no ?? null,
        shop_reference: row.bc_shop_order_no ?? null,
        progress,
      }
    })

    const res = NextResponse.json({
      shop_order_key: key,
      lines,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    logApiError(e, { route: '/api/portal/grote-inpak-status', method: 'POST' })
    return NextResponse.json({ error: 'Er ging iets mis. Probeer later opnieuw.' }, { status: 500 })
  }
}
