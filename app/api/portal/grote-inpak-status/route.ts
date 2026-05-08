import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import {
  groupActiveProductionLogsByFp,
  type ProductionTimeActiveSummary,
} from '@/lib/grote-inpak/production-time-floor'
import { PORTAL_CASE_SELECT, mapCaseRowToPortalLine } from '@/lib/grote-inpak/portal-case'

export const dynamic = 'force-dynamic'

const MAX_SHOP_ORDERS_PER_REQUEST = 35

function splitShopOrderInput(raw: string): string[] {
  const parts: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    for (const piece of line.split(/[,;]+/)) {
      const t = piece.trim()
      if (t) parts.push(t)
    }
  }
  return parts
}

/** Zoekt cases voor één genormaliseerde shop-sleutel (zelfde logica als enkelvoudige lookup). */
async function findCasesForShopKey(rawInput: string, key: string): Promise<any[]> {
  let { data: rows, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select(PORTAL_CASE_SELECT)
    .eq('pils_shop_order_key', key)

  if (error) throw error

  if (!rows || rows.length === 0) {
    const tries = [...new Set([rawInput.replace(/\D/g, ''), key].filter((s) => s.length > 0))]
    for (const t of tries) {
      const { data: hit, error: e2 } = await supabaseAdmin
        .from('grote_inpak_cases')
        .select(PORTAL_CASE_SELECT)
        .eq('bc_shop_order_no', t)
      if (e2) throw e2
      if (hit?.length) {
        rows = hit
        break
      }
    }
  }

  if (!rows || rows.length === 0) {
    const digitsOnly = rawInput.replace(/\D/g, '')
    if (digitsOnly.length >= 6) {
      const suffixKey = shopOrderMatchKey(digitsOnly)
      if (suffixKey && suffixKey !== key) {
        const { data: hit3, error: e3 } = await supabaseAdmin
          .from('grote_inpak_cases')
          .select(PORTAL_CASE_SELECT)
          .eq('pils_shop_order_key', suffixKey)
        if (e3) throw e3
        if (hit3?.length) rows = hit3
      }
    }
  }

  return rows || []
}

function casesToLines(cases: any[], floorByFp: Map<string, ProductionTimeActiveSummary>) {
  return cases.map((row) => mapCaseRowToPortalLine(row as Record<string, unknown>, floorByFp))
}

/**
 * Body: { shopOrder?: string, shopOrders?: string[] }
 * Meerdere nummers: nieuwe regel, komma of puntkomma. Max 35 per aanvraag.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const fromText = splitShopOrderInput(String(body.shopOrder ?? body.shop_order ?? ''))
    const fromArray = Array.isArray(body.shopOrders)
      ? body.shopOrders.map((s: unknown) => String(s ?? '').trim()).filter(Boolean)
      : []
    const combined = [...fromText, ...fromArray]
    if (combined.length > MAX_SHOP_ORDERS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `U kunt maximaal ${MAX_SHOP_ORDERS_PER_REQUEST} shoporders tegelijk opvragen. Verklein de lijst en probeer opnieuw.`,
        },
        { status: 400 },
      )
    }
    const tokens = combined

    /** Eerste invoer per unieke match-sleutel (volgorde behouden) */
    const keyToQueryLabel = new Map<string, string>()
    for (const token of tokens) {
      const key = shopOrderMatchKey(token || undefined)
      if (!key) continue
      if (!keyToQueryLabel.has(key)) keyToQueryLabel.set(key, token)
    }

    if (keyToQueryLabel.size === 0) {
      return NextResponse.json(
        {
          error:
            'Geen geldige shopordernummers. Vul minstens één nummer in (één per regel, of gescheiden door komma).',
        },
        { status: 400 },
      )
    }

    const keyResults: { key: string; queriedAs: string; cases: any[] }[] = []
    for (const [key, queriedAs] of keyToQueryLabel) {
      const cases = await findCasesForShopKey(queriedAs, key)
      keyResults.push({ key, queriedAs, cases })
    }

    const allCases = keyResults.flatMap((kr) => kr.cases)
    let floorByFp = new Map<string, ProductionTimeActiveSummary>()
    if (allCases.some((c) => c.bc_fp_item_no)) {
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

    const results = keyResults.map((kr) => ({
      shop_order_key: kr.key,
      queried_as: kr.queriedAs,
      found: kr.cases.length > 0,
      lines: casesToLines(kr.cases, floorByFp),
    }))

    const allLines = results.flatMap((r) => r.lines)
    const res = NextResponse.json({
      results,
      /** Totaal aantal lijnen over alle gevonden shoporders */
      total_lines: allLines.length,
      total_requested: keyToQueryLabel.size,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    logApiError(e, { route: '/api/portal/grote-inpak-status', method: 'POST' })
    return NextResponse.json({ error: 'Er ging iets mis. Probeer later opnieuw.' }, { status: 500 })
  }
}
