import { supabaseAdmin } from '@/lib/supabase/server'
import { poFloorStatusLabel } from '@/lib/grote-inpak/po-floor-status'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import {
  groupActiveProductionLogsByFp,
  type ProductionTimeActiveSummary,
} from '@/lib/grote-inpak/production-time-floor'
import { PORTAL_CASE_SELECT, mapCaseRowToPortalLine } from '@/lib/grote-inpak/portal-case'
import { fetchPrepackQueueStats } from '@/lib/prepack/queue-stats'
import { getPersonalAssistantDailyBriefing } from '@/lib/personal-assistant/briefing'
import { resolveAssistantDateRange } from '@/lib/personal-assistant/date-range'
import {
  getGroteInpakBacklogSummary,
  getGroteInpakKanbanSummary,
  getGroteInpakProductionOrdersSummary,
  getGroteInpakStockLookup,
} from '@/lib/personal-assistant/grote-inpak-extra'
import { rememberAssistantFact, recallAssistantMemory, type MemorySubjectType } from '@/lib/personal-assistant/memory'
import {
  getAirtecStatsForAssistant,
  getAirtecStockSummary,
  getPrepackStatsForAssistant,
  getPrepackStageKistenSummary,
} from '@/lib/personal-assistant/prepack-airtec-extra'
import { getActiveProductionSummary, getProductionKpiSummary } from '@/lib/personal-assistant/production-extra'

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export async function getGroteInpakSummary() {
  const { data, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('case_label, case_type, productielocatie, status, priority, in_willebroek, arrival_date, forecast_date')

  if (error) throw error

  const rows = data || []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let overdue = 0
  let priority = 0
  let inWillebroek = 0
  const byLocation: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  for (const row of rows) {
    if (row.priority) priority += 1
    if (row.in_willebroek) inWillebroek += 1

    const loc = row.productielocatie || 'Onbekend'
    byLocation[loc] = (byLocation[loc] || 0) + 1

    const status = row.status || 'Onbekend'
    byStatus[status] = (byStatus[status] || 0) + 1

    const refDate = row.forecast_date || row.arrival_date
    if (refDate) {
      const d = new Date(refDate)
      d.setHours(0, 0, 0, 0)
      if (d < today && !row.in_willebroek) overdue += 1
    }
  }

  const todayIso = today.toISOString().split('T')[0]
  const priorityRows = rows
    .filter(row => row.priority === true)
    .map(row => ({
      case_label: row.case_label,
      case_type: row.case_type,
      productielocatie: row.productielocatie,
      status: row.status,
      arrival_date: row.arrival_date,
      forecast_date: row.forecast_date,
    }))
    .slice(0, 12)

  const overdueRows = rows
    .filter(row => {
      if (row.in_willebroek) return false
      const refDate = row.forecast_date || row.arrival_date
      if (!refDate) return false
      const d = new Date(refDate)
      d.setHours(0, 0, 0, 0)
      return d < today
    })
    .map(row => ({
      case_label: row.case_label,
      case_type: row.case_type,
      productielocatie: row.productielocatie,
      status: row.status,
      ref_date: row.forecast_date || row.arrival_date,
    }))
    .slice(0, 12)

  return {
    as_of: todayIso,
    total_cases: rows.length,
    priority_cases: priority,
    in_willebroek: inWillebroek,
    overdue_cases: overdue,
    by_location: byLocation,
    by_status: byStatus,
    priority_sample: priorityRows,
    overdue_sample: overdueRows,
  }
}

export async function searchGroteInpakCases(input: {
  search?: string
  location?: string
  priority_only?: boolean
  overdue_only?: boolean
  limit?: number
}) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 60)

  let query = supabaseAdmin
    .from('grote_inpak_cases')
    .select(
      'case_label, case_type, productielocatie, status, priority, comment, in_willebroek, arrival_date, forecast_date, bc_shop_order_no, bc_customer_order_no, bc_fp_item_no'
    )
    .order('arrival_date', { ascending: true, nullsFirst: false })
    .limit(300)

  if (input.location && input.location !== 'Alle') {
    query = query.eq('productielocatie', input.location)
  }
  if (input.priority_only) {
    query = query.eq('priority', true)
  }

  const { data, error } = await query
  if (error) throw error

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const search = (input.search || '').trim().toUpperCase()

  let rows = (data || []).map(row => {
    const refDate = row.forecast_date || row.arrival_date
    let dagenTeLaat = 0
    if (refDate && !row.in_willebroek) {
      const d = new Date(refDate)
      d.setHours(0, 0, 0, 0)
      if (d < today) {
        dagenTeLaat = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
      }
    }
    return { ...row, dagen_te_laat: dagenTeLaat }
  })

  if (input.overdue_only) {
    rows = rows.filter(row => row.dagen_te_laat > 0)
  }

  if (search) {
    rows = rows.filter(row => {
      const haystack = [
        row.case_label,
        row.case_type,
        row.bc_shop_order_no,
        row.bc_customer_order_no,
        row.bc_fp_item_no,
        row.comment,
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()
      return haystack.includes(search)
    })
  }

  return {
    total_matches: rows.length,
    shown: rows.slice(0, limit).map(row => ({
      case_label: row.case_label,
      case_type: row.case_type,
      productielocatie: row.productielocatie,
      status: row.status,
      priority: row.priority === true,
      in_willebroek: row.in_willebroek === true,
      arrival_date: row.arrival_date,
      forecast_date: row.forecast_date,
      dagen_te_laat: row.dagen_te_laat,
      bc_shop_order_no: row.bc_shop_order_no,
      bc_customer_order_no: row.bc_customer_order_no,
      comment: row.comment ? String(row.comment).slice(0, 180) : null,
    })),
  }
}

export async function getKistProductionStatus(kistnummer: string) {
  const code = normalizeCode(kistnummer)

  const { data, error } = await supabaseAdmin
    .from('grote_inpak_production_orders')
    .select('*')
    .eq('kistnummer', code)
    .order('ending_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  const orders = data || []
  const openOrders = orders.filter(row => Number(row.remaining_quantity ?? 0) > 0)

  const { data: floorRows } = await supabaseAdmin
    .from('grote_inpak_production_order_floor_status')
    .select('prod_order_no, item_no, bc_source, floor_status, note, updated_at')
    .in('prod_order_no', Array.from(new Set(orders.map(row => row.prod_order_no))))

  const floorMap = new Map<string, { floor_status: string; note: string | null }>()
  for (const floor of floorRows || []) {
    floorMap.set(`${floor.prod_order_no}\0${floor.item_no}\0${floor.bc_source || 'bc36'}`, {
      floor_status: floor.floor_status,
      note: floor.note ?? null,
    })
  }

  const enriched = orders.map(row => {
    const floor = floorMap.get(`${row.prod_order_no}\0${row.item_no}\0${row.bc_source || 'bc36'}`)
    return {
      prod_order_no: row.prod_order_no,
      item_no: row.item_no,
      productielocatie: row.productielocatie,
      remaining_quantity: Number(row.remaining_quantity ?? 0),
      ending_date: row.ending_date,
      floor_status: floor?.floor_status ?? null,
      floor_status_label: poFloorStatusLabel(floor?.floor_status),
      floor_status_note: floor?.note ?? null,
    }
  })

  const { data: memory } = await supabaseAdmin
    .from('grote_inpak_ai_memory')
    .select('memory_type, value, note, updated_at')
    .eq('subject_type', 'case_type')
    .eq('subject_key', code)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(8)

  const primary = openOrders.find(row => row.ending_date) || openOrders[0] || orders[0] || null
  const primaryFloor = primary
    ? floorMap.get(`${primary.prod_order_no}\0${primary.item_no}\0${primary.bc_source || 'bc36'}`)
    : null

  return {
    kistnummer: code,
    open_orders: openOrders.length,
    total_orders: orders.length,
    earliest_ending: openOrders.find(row => row.ending_date)?.ending_date || orders.find(row => row.ending_date)?.ending_date || null,
    primary_order: primary
      ? {
          prod_order_no: primary.prod_order_no,
          ending_date: primary.ending_date,
          remaining_quantity: Number(primary.remaining_quantity ?? 0),
          floor_status_label: poFloorStatusLabel(primaryFloor?.floor_status),
          floor_status_note: primaryFloor?.note ?? null,
        }
      : null,
    orders: enriched.slice(0, 12),
    ai_memory: memory || [],
  }
}

async function findCasesForShopKey(rawInput: string, key: string) {
  let { data: rows, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select(PORTAL_CASE_SELECT)
    .eq('pils_shop_order_key', key)

  if (error) throw error

  if (!rows?.length) {
    const tries = [...new Set([rawInput.replace(/\D/g, ''), key].filter(Boolean))]
    for (const t of tries) {
      const { data: hit } = await supabaseAdmin
        .from('grote_inpak_cases')
        .select(PORTAL_CASE_SELECT)
        .eq('bc_shop_order_no', t)
      if (hit?.length) {
        rows = hit
        break
      }
    }
  }

  if (!rows?.length) {
    const digitsOnly = rawInput.replace(/\D/g, '')
    if (digitsOnly.length >= 6) {
      const suffixKey = shopOrderMatchKey(digitsOnly)
      if (suffixKey && suffixKey !== key) {
        const { data: hit3 } = await supabaseAdmin
          .from('grote_inpak_cases')
          .select(PORTAL_CASE_SELECT)
          .eq('pils_shop_order_key', suffixKey)
        if (hit3?.length) rows = hit3
      }
    }
  }

  return rows || []
}

export async function getAtlasOrderStatus(shopOrder: string) {
  const raw = shopOrder.trim()
  const key = shopOrderMatchKey(raw)
  if (!key) {
    return { shop_order: raw, found: false, lines: [] as ReturnType<typeof mapCaseRowToPortalLine>[] }
  }

  const cases = await findCasesForShopKey(raw, key)
  let floorByFp = new Map<string, ProductionTimeActiveSummary>()

  if (cases.some(row => row.bc_fp_item_no)) {
    const { data: activeLogs, error: logErr } = await supabaseAdmin
      .from('time_logs')
      .select('employee_id, production_item_number, production_step, production_order_number, start_time')
      .is('end_time', null)
      .eq('type', 'production_order')

    if (!logErr && activeLogs?.length) {
      const empIds = [...new Set(activeLogs.map(log => log.employee_id).filter(Boolean))]
      const { data: emps } = await supabaseAdmin.from('employees').select('id, name').in('id', empIds)
      const empMap = new Map<number, string>()
      for (const emp of emps || []) {
        empMap.set(Number(emp.id), String(emp.name || ''))
      }
      floorByFp = groupActiveProductionLogsByFp(activeLogs, empMap)
    }
  }

  const lines = cases.map(row => mapCaseRowToPortalLine(row as Record<string, unknown>, floorByFp))

  return {
    shop_order: raw,
    shop_order_key: key,
    found: lines.length > 0,
    lines,
  }
}

export async function getPrepackQueueSummary() {
  const queue = await fetchPrepackQueueStats()

  const [{ count: problemCount }, { count: measurementCount }, { count: openLines }] =
    await Promise.all([
      supabaseAdmin
        .from('items_to_pack')
        .select('*', { count: 'exact', head: true })
        .eq('packed', false)
        .eq('problem', true),
      supabaseAdmin
        .from('items_to_pack')
        .select('*', { count: 'exact', head: true })
        .eq('packed', false)
        .eq('measurement', true),
      supabaseAdmin
        .from('items_to_pack')
        .select('*', { count: 'exact', head: true })
        .eq('packed', false),
    ])

  return {
    source: 'admin/prepack wachtrij',
    open_lines: openLines ?? queue.queueLines,
    queue_stuks: queue.queueStuks,
    backlog_stuks: queue.backlogStuks,
    backlog_pct: queue.backlogPct,
    priority_stuks: queue.priorityStuks,
    oldest_working_days: queue.oldestWorkingDays,
    avg_lead_time_days: queue.avgLeadTimeDays,
    problem_lines: problemCount ?? 0,
    measurement_lines: measurementCount ?? 0,
    top_critical: queue.topCritical,
  }
}

export async function getPrepackStats(input?: {
  date_from?: string
  date_to?: string
  period?: string
  compare_previous_period?: boolean
  person_name?: string
  limit_people?: number
}) {
  return getPrepackStatsForAssistant(input)
}

export async function getAirtecStats(input?: {
  date_from?: string
  date_to?: string
  period?: string
  compare_previous_period?: boolean
  person_name?: string
  limit_people?: number
}) {
  return getAirtecStatsForAssistant(input)
}

export async function getGroteInpakPackedSummary(input?: {
  date_from?: string
  date_to?: string
  days?: number
  period?: string
}) {
  const range = resolveAssistantDateRange({
    date_from: input?.date_from,
    date_to: input?.date_to,
    period: input?.period,
    defaultDays: typeof input?.days === 'number' ? Math.min(Math.max(input.days, 1), 90) : 30,
  })

  const { data: packedRows, error: packedError } = await supabaseAdmin
    .from('grote_inpak_packed')
    .select('case_label, case_type, packed_date, packed_file')
    .gte('packed_date', range.date_from)
    .lte('packed_date', range.date_to)
    .order('packed_date', { ascending: false })
    .limit(500)

  if (packedError) throw packedError

  const rows = packedRows || []
  const uniqueCases = new Set(rows.map(r => r.case_label).filter(Boolean))
  const byDate: Record<string, number> = {}
  const byCaseType: Record<string, number> = {}

  for (const row of rows) {
    const d = String(row.packed_date || '').slice(0, 10)
    if (d) byDate[d] = (byDate[d] || 0) + 1
    const ct = row.case_type || 'Onbekend'
    byCaseType[ct] = (byCaseType[ct] || 0) + 1
  }

  const [{ count: draftBatches }, { count: totalPackedAllTime }] = await Promise.all([
    supabaseAdmin
      .from('grote_inpak_packed_import_batches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabaseAdmin.from('grote_inpak_packed').select('*', { count: 'exact', head: true }),
  ])

  const { data: draftBatchSample } = await supabaseAdmin
    .from('grote_inpak_packed_import_batches')
    .select('id, source_file, source_type, status, imported_at')
    .eq('status', 'draft')
    .order('imported_at', { ascending: false })
    .limit(5)

  return {
    source: 'grote-inpak Packed-tab',
    period: range,
    packed_rows_in_period: rows.length,
    unique_cases_in_period: uniqueCases.size,
    total_packed_rows_all_time: totalPackedAllTime ?? rows.length,
    by_date: byDate,
    top_case_types: Object.entries(byCaseType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([case_type, count]) => ({ case_type, count })),
    recent_packed: rows.slice(0, 10).map(r => ({
      case_label: r.case_label,
      case_type: r.case_type,
      packed_date: r.packed_date,
      packed_file: r.packed_file,
    })),
    draft_import_batches: draftBatches ?? 0,
    draft_batch_sample: draftBatchSample || [],
  }
}

export async function getGroteInpakPriorityOverview(input?: { limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 40)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select(
      'case_label, case_type, productielocatie, status, priority, in_willebroek, arrival_date, forecast_date, comment'
    )
    .order('priority', { ascending: false })
    .order('arrival_date', { ascending: true, nullsFirst: false })
    .limit(400)

  if (error) throw error

  const rows = data || []
  const priority = rows.filter(r => r.priority === true)
  const overdue = rows.filter(r => {
    if (r.in_willebroek) return false
    const ref = r.forecast_date || r.arrival_date
    if (!ref) return false
    const d = new Date(ref)
    d.setHours(0, 0, 0, 0)
    return d < today
  })

  const mapRow = (row: (typeof rows)[0], includeDays = false) => {
    const ref = row.forecast_date || row.arrival_date
    let dagen_te_laat = 0
    if (includeDays && ref && !row.in_willebroek) {
      const d = new Date(ref)
      d.setHours(0, 0, 0, 0)
      if (d < today) {
        dagen_te_laat = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
      }
    }
    return {
      case_label: row.case_label,
      case_type: row.case_type,
      productielocatie: row.productielocatie,
      status: row.status,
      priority: row.priority === true,
      ref_date: ref,
      dagen_te_laat: includeDays ? dagen_te_laat : undefined,
      comment: row.comment ? String(row.comment).slice(0, 120) : null,
    }
  }

  return {
    source: 'grote-inpak',
    total_priority: priority.length,
    total_overdue: overdue.length,
    priority_cases: priority.slice(0, limit).map(r => mapRow(r)),
    overdue_cases: overdue.slice(0, limit).map(r => mapRow(r, true)),
  }
}

export type PersonalAssistantToolName =
  | 'grote_inpak_summary'
  | 'grote_inpak_priority_overview'
  | 'grote_inpak_packed_summary'
  | 'grote_inpak_kanban_summary'
  | 'grote_inpak_stock_lookup'
  | 'grote_inpak_backlog_summary'
  | 'grote_inpak_production_orders_summary'
  | 'search_grote_inpak_cases'
  | 'kist_production_status'
  | 'atlas_order_status'
  | 'prepack_queue_summary'
  | 'prepack_stats'
  | 'prepack_stage_kisten'
  | 'airtec_stats'
  | 'airtec_stock_summary'
  | 'production_kpi_summary'
  | 'active_production_summary'
  | 'daily_briefing'
  | 'assistant_remember'
  | 'assistant_recall_memory'

export type PersonalAssistantToolContext = {
  user_id?: string | null
}

export async function runPersonalAssistantTool(
  name: PersonalAssistantToolName,
  args: Record<string, unknown>,
  context?: PersonalAssistantToolContext
): Promise<unknown> {
  switch (name) {
    case 'grote_inpak_summary':
      return getGroteInpakSummary()
    case 'search_grote_inpak_cases':
      return searchGroteInpakCases({
        search: typeof args.search === 'string' ? args.search : undefined,
        location: typeof args.location === 'string' ? args.location : undefined,
        priority_only: args.priority_only === true,
        overdue_only: args.overdue_only === true,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      })
    case 'kist_production_status':
      return getKistProductionStatus(String(args.kistnummer || args.kist || ''))
    case 'atlas_order_status':
      return getAtlasOrderStatus(String(args.shop_order || args.shopOrder || ''))
    case 'prepack_queue_summary':
      return getPrepackQueueSummary()
    case 'prepack_stats':
      return getPrepackStats({
        date_from: typeof args.date_from === 'string' ? args.date_from : undefined,
        date_to: typeof args.date_to === 'string' ? args.date_to : undefined,
        period: typeof args.period === 'string' ? args.period : undefined,
        compare_previous_period: args.compare_previous_period === true,
        person_name: typeof args.person_name === 'string' ? args.person_name : undefined,
        limit_people: typeof args.limit_people === 'number' ? args.limit_people : undefined,
      })
    case 'prepack_stage_kisten':
      return getPrepackStageKistenSummary()
    case 'airtec_stats':
      return getAirtecStats({
        date_from: typeof args.date_from === 'string' ? args.date_from : undefined,
        date_to: typeof args.date_to === 'string' ? args.date_to : undefined,
        period: typeof args.period === 'string' ? args.period : undefined,
        compare_previous_period: args.compare_previous_period === true,
        person_name: typeof args.person_name === 'string' ? args.person_name : undefined,
        limit_people: typeof args.limit_people === 'number' ? args.limit_people : undefined,
      })
    case 'airtec_stock_summary':
      return getAirtecStockSummary({
        low_stock_only: args.low_stock_only === true,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      })
    case 'grote_inpak_kanban_summary':
      return getGroteInpakKanbanSummary(typeof args.limit === 'number' ? args.limit : 12)
    case 'grote_inpak_stock_lookup':
      return getGroteInpakStockLookup(String(args.kistnummer || args.kist || ''))
    case 'grote_inpak_backlog_summary':
      return getGroteInpakBacklogSummary(typeof args.limit === 'number' ? args.limit : 20)
    case 'grote_inpak_production_orders_summary':
      return getGroteInpakProductionOrdersSummary({
        kistnummer: typeof args.kistnummer === 'string' ? args.kistnummer : undefined,
      })
    case 'production_kpi_summary':
      return getProductionKpiSummary({
        site: typeof args.site === 'string' ? args.site : undefined,
        date_from: typeof args.date_from === 'string' ? args.date_from : undefined,
        date_to: typeof args.date_to === 'string' ? args.date_to : undefined,
        period: typeof args.period === 'string' ? args.period : undefined,
      })
    case 'active_production_summary':
      return getActiveProductionSummary(
        Array.isArray(args.sites)
          ? (args.sites as unknown[]).map(s => String(s))
          : undefined
      )
    case 'daily_briefing':
      return getPersonalAssistantDailyBriefing()
    case 'assistant_remember':
      return rememberAssistantFact({
        subject_type: (args.subject_type as MemorySubjectType) || 'general',
        subject_key: String(args.subject_key || 'global'),
        value: String(args.value || ''),
        note: typeof args.note === 'string' ? args.note : undefined,
        memory_type: typeof args.memory_type === 'string' ? args.memory_type : undefined,
        user_id: context?.user_id || undefined,
      })
    case 'assistant_recall_memory':
      return recallAssistantMemory({
        subject_type: args.subject_type as MemorySubjectType | undefined,
        subject_key: typeof args.subject_key === 'string' ? args.subject_key : undefined,
        search: typeof args.search === 'string' ? args.search : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      })
    case 'grote_inpak_packed_summary':
      return getGroteInpakPackedSummary({
        date_from: typeof args.date_from === 'string' ? args.date_from : undefined,
        date_to: typeof args.date_to === 'string' ? args.date_to : undefined,
        days: typeof args.days === 'number' ? args.days : undefined,
        period: typeof args.period === 'string' ? args.period : undefined,
      })
    case 'grote_inpak_priority_overview':
      return getGroteInpakPriorityOverview({
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      })
    default:
      throw new Error(`Onbekende tool: ${name}`)
  }
}

export const PERSONAL_ASSISTANT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_summary',
      description:
        'Haal een samenvatting op van Grote Inpak (/grote-inpak): totaal cases, priority, achterstand, locaties, statussen en korte samples.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_priority_overview',
      description:
        'Lijst actieve priority-cases en cases met achterstand (dagen te laat) op Grote Inpak, zoals op het overzicht.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max cases per lijst, standaard 20.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_packed_summary',
      description:
        'Actuele Packed-tab Grote Inpak: verpakte kisten per periode (NIET Prepack). Gebruik alleen bij expliciet Grote Inpak/packed kisten.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Startdatum YYYY-MM-DD.' },
          date_to: { type: 'string', description: 'Einddatum YYYY-MM-DD.' },
          period: { type: 'string', description: 'vandaag, deze_week, vorige_week, deze_maand, vorige_maand.' },
          days: { type: 'number', description: 'Alternatief: laatste N dagen (1-90), standaard 30.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_grote_inpak_cases',
      description: 'Zoek Grote Inpak cases op tekst, locatie, priority of achterstand.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Vrije zoekterm: caselabel, kisttype, shoporder, klantorder, comment.' },
          location: { type: 'string', description: 'Filter op productielocatie, bv. Wilrijk, Genk, Willebroek.' },
          priority_only: { type: 'boolean' },
          overdue_only: { type: 'boolean', description: 'Alleen cases met achterstand.' },
          limit: { type: 'number', description: 'Max aantal resultaten, standaard 25.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'kist_production_status',
      description: 'Zoek productieorders, einddatum en vloerstatus voor een kisttype zoals K352 of K114.',
      parameters: {
        type: 'object',
        properties: {
          kistnummer: { type: 'string', description: 'Kisttype / kistnummer, bv. K352.' },
        },
        required: ['kistnummer'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'atlas_order_status',
      description: 'Zoek Atlas/Grote Inpak orderstatus voor een shopordernummer zoals klanten die opzoeken.',
      parameters: {
        type: 'object',
        properties: {
          shop_order: { type: 'string', description: 'Shopordernummer of Atlas orderreferentie.' },
        },
        required: ['shop_order'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'prepack_queue_summary',
      description:
        'Live Prepack-wachtrij (/admin/prepack): stuks, backlog, priority, oudste item, gem. doorlooptijd en top kritieke lijnen.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'prepack_stats',
      description:
        'Actuele Prepack KPIs (/admin/prepack): totals.items_packed, packed_by_person (wie hoeveel stuks verpakt heeft, veld items_packed per naam), uren, omzet. Gebruik bij verpakt bij Prepack of per medewerker. period: vandaag, deze_week, enz. person_name: filter op naam.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Startdatum YYYY-MM-DD.' },
          date_to: { type: 'string', description: 'Einddatum YYYY-MM-DD.' },
          period: { type: 'string', description: 'vandaag, deze_week, vorige_week, deze_maand, vorige_maand.' },
          person_name: {
            type: 'string',
            description: 'Optioneel: filter op medewerker (deel van naam), bv. "Jan".',
          },
          limit_people: {
            type: 'number',
            description: 'Max aantal personen in packed_by_person (standaard 20).',
          },
          compare_previous_period: { type: 'boolean', description: 'Vergelijk met vorige periode van zelfde lengte.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'prepack_stage_kisten',
      description: 'Prepack stage-kisten nodig voor de huidige wachtrij (admin prepack).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'airtec_stats',
      description:
        'Airtec KPIs (/admin/airtec): packed_by_person met items_packed per medewerker, zoals prepack_stats.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          period: { type: 'string' },
          person_name: { type: 'string', description: 'Filter op medewerkernaam.' },
          limit_people: { type: 'number', description: 'Max personen in lijst.' },
          compare_previous_period: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'airtec_stock_summary',
      description: 'Airtec kistenvoorraad: huidig vs minimum, te bestellen.',
      parameters: {
        type: 'object',
        properties: {
          low_stock_only: { type: 'boolean' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_kanban_summary',
      description: 'Kanban C-kisten: urgente tekorten, stock in rek, verbruik.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_stock_lookup',
      description: 'Stock per locatie voor een kistnummer op Grote Inpak.',
      parameters: {
        type: 'object',
        properties: { kistnummer: { type: 'string' } },
        required: ['kistnummer'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_backlog_summary',
      description: 'Backlog-tab: cases met achterstand die nog niet packed zijn.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_production_orders_summary',
      description: 'Open productieorders Grote Inpak, optioneel gefilterd op kist.',
      parameters: {
        type: 'object',
        properties: { kistnummer: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'production_kpi_summary',
      description: 'Productieorder KPI per site (wilrijk/genk) en periode.',
      parameters: {
        type: 'object',
        properties: {
          site: { type: 'string' },
          period: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'active_production_summary',
      description: 'Wie draait nu op productieorders (live KPI-pagina).',
      parameters: {
        type: 'object',
        properties: {
          sites: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'daily_briefing',
      description:
        'Ochtendbriefing: prepack wachtrij, grote inpak, packed, kanban urgent, actieve productie, week KPIs.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'assistant_remember',
      description: 'Sla een feit of voorkeur op in AI-geheugen (read-write).',
      parameters: {
        type: 'object',
        properties: {
          subject_type: { type: 'string', enum: ['case_type', 'case_label', 'production_order', 'general'] },
          subject_key: { type: 'string' },
          value: { type: 'string' },
          note: { type: 'string' },
          memory_type: { type: 'string' },
        },
        required: ['value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'assistant_recall_memory',
      description: 'Haal opgeslagen AI-geheugen op.',
      parameters: {
        type: 'object',
        properties: {
          subject_type: { type: 'string' },
          subject_key: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
]
