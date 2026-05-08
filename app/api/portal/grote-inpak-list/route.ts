import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { groupActiveProductionLogsByFp, type ProductionTimeActiveSummary } from '@/lib/grote-inpak/production-time-floor'
import { PORTAL_CASE_SELECT, mapCaseRowToPortalLine } from '@/lib/grote-inpak/portal-case'

export const dynamic = 'force-dynamic'

/** Max rijen uit DB per aanvraag (filteren gebeurt in geheugen; verklein met zoekvelden bij grote datasets). */
const MAX_FETCH = 3000
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

function sanitizeIlikeFragment(s: string): string {
  return s.replace(/[%_]/g, '').trim()
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(10, parseInt(sp.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    )
    const kist = sanitizeIlikeFragment(sp.get('kist') || '')
    const order = sanitizeIlikeFragment(sp.get('order') || '')
    const item = sanitizeIlikeFragment(sp.get('item') || '')
    const statusFilter = (sp.get('status') || '').trim()

    let query = supabaseAdmin
      .from('grote_inpak_cases')
      .select(PORTAL_CASE_SELECT)
      .order('arrival_date', { ascending: true, nullsFirst: false })
      .limit(MAX_FETCH)

    if (kist) {
      query = query.ilike('case_label', `%${kist}%`)
    }
    if (order) {
      query = query.or(
        `bc_shop_order_no.ilike.%${order}%,pils_shop_order_key.ilike.%${order}%,bc_customer_order_no.ilike.%${order}%`,
      )
    }
    if (item) {
      query = query.or(`bc_fp_item_no.ilike.%${item}%,serial_number.ilike.%${item}%`)
    }

    const { data: rows, error } = await query
    if (error) throw error

    const list = rows || []

    let floorByFp = new Map<string, ProductionTimeActiveSummary>()
    if (list.some((c: { bc_fp_item_no?: string | null }) => c.bc_fp_item_no)) {
      const { data: activeLogs, error: logErr } = await supabaseAdmin
        .from('time_logs')
        .select('employee_id, production_item_number, production_step, production_order_number, start_time')
        .is('end_time', null)
        .eq('type', 'production_order')

      if (!logErr && activeLogs?.length) {
        const empIds = [...new Set(activeLogs.map((l: { employee_id?: number }) => l.employee_id).filter(Boolean))]
        const { data: emps } = await supabaseAdmin.from('employees').select('id, name').in('id', empIds)
        const empMap = new Map<number, string>()
        ;(emps || []).forEach((e: { id: number; name?: string | null }) =>
          empMap.set(Number(e.id), String(e.name || '')),
        )
        floorByFp = groupActiveProductionLogsByFp(activeLogs as Parameters<typeof groupActiveProductionLogsByFp>[0], empMap)
      }
    }

    let lines = list.map((row: Record<string, unknown>) => mapCaseRowToPortalLine(row, floorByFp))

    if (statusFilter && statusFilter !== 'Alle') {
      const q = statusFilter.toLowerCase()
      lines = lines.filter((l) => l.progress.headline.toLowerCase().includes(q))
    }

    const total = lines.length
    const start = (page - 1) * pageSize
    const pageLines = lines.slice(start, start + pageSize)
    const truncated = list.length >= MAX_FETCH

    const res = NextResponse.json({
      lines: pageLines,
      total,
      page,
      pageSize,
      truncated,
      max_fetch: MAX_FETCH,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: unknown) {
    logApiError(e, { route: '/api/portal/grote-inpak-list', method: 'GET' })
    return NextResponse.json({ error: 'Er ging iets mis. Probeer later opnieuw.' }, { status: 500 })
  }
}
