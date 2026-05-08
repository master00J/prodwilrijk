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

function normalizePortalSalesOrder(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

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

/**
 * Publieke statuslookup voor klanten — geen interne velden (Atlas, comments, serienummer).
 * Body: { salesOrder: string, shopKey?: string } — shopKey = optionele 6-cijfercode (zelfde als shop-key op orderbevestiging).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const salesOrder = normalizePortalSalesOrder(body.salesOrder ?? body.sales_order)
    const shopKeyRaw = body.shopKey ?? body.shop_key ?? ''

    if (salesOrder.length < 4) {
      return NextResponse.json(
        { error: 'Vul een geldig verkoopordernummer in (zoals op uw orderbevestiging).' },
        { status: 400 },
      )
    }

    const { data: rows, error } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select(
        'case_label, case_type, productielocatie, in_willebroek, arrival_date, deadline, dagen_te_laat, bc_line_description, bc_fp_item_no, bc_shop_order_no, pils_shop_order_key, serial_number',
      )
      .eq('bc_sales_order_no', salesOrder)

    if (error) throw error

    const notFoundMsg =
      'We vinden geen actuele status voor dit nummer. Controleer de invoer of neem contact op met uw contactpersoon.'

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: notFoundMsg }, { status: 404 })
    }

    let cases = rows as any[]
    const shopKeyNorm = shopKeyRaw != null && String(shopKeyRaw).trim() !== '' ? shopOrderMatchKey(String(shopKeyRaw)) : null
    if (shopKeyNorm) {
      cases = cases.filter((r) => {
        const k =
          shopOrderMatchKey(r.serial_number) ??
          shopOrderMatchKey(String(r.pils_shop_order_key ?? '').trim() || undefined)
        return k === shopKeyNorm
      })
    }

    if (cases.length === 0) {
      return NextResponse.json({ error: notFoundMsg }, { status: 404 })
    }

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

    const res = NextResponse.json({ sales_order: salesOrder, lines })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    logApiError(e, { route: '/api/portal/grote-inpak-status', method: 'POST' })
    return NextResponse.json({ error: 'Er ging iets mis. Probeer later opnieuw.' }, { status: 500 })
  }
}
