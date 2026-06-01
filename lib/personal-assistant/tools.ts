import { supabaseAdmin } from '@/lib/supabase/server'
import { poFloorStatusLabel } from '@/lib/grote-inpak/po-floor-status'
import { shopOrderMatchKey } from '@/lib/grote-inpak/pils-serial'
import {
  groupActiveProductionLogsByFp,
  type ProductionTimeActiveSummary,
} from '@/lib/grote-inpak/production-time-floor'
import { PORTAL_CASE_SELECT, mapCaseRowToPortalLine } from '@/lib/grote-inpak/portal-case'

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

  return {
    total_cases: rows.length,
    priority_cases: priority,
    in_willebroek: inWillebroek,
    overdue_cases: overdue,
    by_location: byLocation,
    by_status: byStatus,
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
  const [{ count: openCount, error: openError }, { data: priorityRows, error: priorityError }] =
    await Promise.all([
      supabaseAdmin.from('items_to_pack').select('*', { count: 'exact', head: true }).eq('packed', false),
      supabaseAdmin
        .from('items_to_pack')
        .select('item_number, po_number, priority, problem, measurement, date_added')
        .eq('packed', false)
        .eq('priority', true)
        .order('date_added', { ascending: true })
        .limit(15),
    ])

  if (openError) throw openError
  if (priorityError) throw priorityError

  const [{ count: problemCount }, { count: measurementCount }] = await Promise.all([
    supabaseAdmin.from('items_to_pack').select('*', { count: 'exact', head: true }).eq('packed', false).eq('problem', true),
    supabaseAdmin.from('items_to_pack').select('*', { count: 'exact', head: true }).eq('packed', false).eq('measurement', true),
  ])

  return {
    open_items: openCount ?? 0,
    priority_items: priorityRows?.length ?? 0,
    problem_items: problemCount ?? 0,
    measurement_items: measurementCount ?? 0,
    priority_sample: (priorityRows || []).map(row => ({
      item_number: row.item_number,
      po_number: row.po_number,
      date_added: row.date_added,
    })),
  }
}

export type PersonalAssistantToolName =
  | 'grote_inpak_summary'
  | 'search_grote_inpak_cases'
  | 'kist_production_status'
  | 'atlas_order_status'
  | 'prepack_queue_summary'

export async function runPersonalAssistantTool(
  name: PersonalAssistantToolName,
  args: Record<string, unknown>
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
    default:
      throw new Error(`Onbekende tool: ${name}`)
  }
}

export const PERSONAL_ASSISTANT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'grote_inpak_summary',
      description: 'Haal een samenvatting op van alle Grote Inpak cases: totaal, priority, achterstand, locaties en statussen.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
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
      description: 'Haal een kort overzicht op van de Prepack wachtrij: open items, priority, problemen en opmetingen.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]
