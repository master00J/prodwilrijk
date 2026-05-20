import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { isValidPoFloorStatus, poFloorStatusLabel, type PoFloorStatusValue } from '@/lib/grote-inpak/po-floor-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const statusRequestSchema = z.object({
  kistnummer: z.string().trim().min(1).max(80),
  floor_status: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).nullable().optional(),
  only_open: z.boolean().default(true),
  remember: z.boolean().default(true),
})

type ProductionOrderRow = {
  id: number
  status: string | null
  prod_order_no: string
  item_no: string
  description: string | null
  productielocatie: string | null
  kistnummer: string | null
  quantity: number | null
  finished_quantity: number | null
  remaining_quantity: number | null
  due_date: string | null
  starting_date: string | null
  ending_date: string | null
  bc_source: string | null
  floor_status?: string | null
  floor_status_note?: string | null
  floor_status_updated_at?: string | null
}

const FLOOR_STATUS_ALIASES: Record<string, PoFloorStatusValue> = {
  nietgestart: 'not_started',
  nognietgestart: 'not_started',
  zagerij: 'sawmill',
  zagen: 'sawmill',
  zaag: 'sawmill',
  sawmill: 'sawmill',
  assemblage: 'assembly',
  montage: 'assembly',
  assembly: 'assembly',
  klaartransport: 'ready_transport',
  klaarvoortransport: 'ready_transport',
  readytransport: 'ready_transport',
  ready_transport: 'ready_transport',
  afgerond: 'completed',
  klaar: 'completed',
  completed: 'completed',
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeStatus(value: string): PoFloorStatusValue | null {
  if (isValidPoFloorStatus(value)) return value
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  return FLOOR_STATUS_ALIASES[key] || null
}

function floorKey(row: Pick<ProductionOrderRow, 'prod_order_no' | 'item_no' | 'bc_source'>): string {
  return `${row.prod_order_no}\0${row.item_no}\0${row.bc_source || 'bc36'}`
}

function sanitizeOrder(row: ProductionOrderRow) {
  return {
    id: row.id,
    status: row.status,
    prod_order_no: row.prod_order_no,
    item_no: row.item_no,
    description: row.description,
    productielocatie: row.productielocatie,
    kistnummer: row.kistnummer,
    quantity: Number(row.quantity ?? 0),
    finished_quantity: Number(row.finished_quantity ?? 0),
    remaining_quantity: Number(row.remaining_quantity ?? 0),
    due_date: row.due_date,
    starting_date: row.starting_date,
    ending_date: row.ending_date,
    bc_source: row.bc_source || 'bc36',
    floor_status: row.floor_status ?? null,
    floor_status_label: poFloorStatusLabel(row.floor_status),
    floor_status_note: row.floor_status_note ?? null,
    floor_status_updated_at: row.floor_status_updated_at ?? null,
  }
}

async function queryOrders(kistnummer: string, onlyOpen: boolean) {
  let query = supabaseAdmin
    .from('grote_inpak_production_orders')
    .select('*')
    .eq('kistnummer', normalizeCode(kistnummer))
    .order('ending_date', { ascending: true, nullsFirst: false })

  if (onlyOpen) query = query.gt('remaining_quantity', 0)

  const { data, error } = await query
  if (error) throw error
  return ((data || []) as ProductionOrderRow[]).map((row) => ({
    ...row,
    bc_source: row.bc_source || 'bc36',
  }))
}

async function loadOrders(kistnummer: string, onlyOpen: boolean) {
  let rows = await queryOrders(kistnummer, onlyOpen)
  const usedClosedFallback = onlyOpen && rows.length === 0

  if (usedClosedFallback) {
    rows = await queryOrders(kistnummer, false)
  }

  if (rows.length === 0) return { rows: [], usedClosedFallback }

  const { data: floorRows, error: floorError } = await supabaseAdmin
    .from('grote_inpak_production_order_floor_status')
    .select('prod_order_no, item_no, bc_source, floor_status, note, updated_at')
    .in('prod_order_no', Array.from(new Set(rows.map((row) => row.prod_order_no))))

  if (floorError) throw floorError

  const floorMap = new Map<string, { floor_status: string; note: string | null; updated_at: string | null }>()
  for (const floor of floorRows || []) {
    floorMap.set(`${floor.prod_order_no}\0${floor.item_no}\0${floor.bc_source || 'bc36'}`, {
      floor_status: floor.floor_status,
      note: floor.note ?? null,
      updated_at: floor.updated_at ?? null,
    })
  }

  const withFloor = rows.map((row) => {
    const floor = floorMap.get(floorKey(row))
    return {
      ...row,
      floor_status: floor?.floor_status ?? null,
      floor_status_note: floor?.note ?? null,
      floor_status_updated_at: floor?.updated_at ?? null,
    }
  })

  return { rows: withFloor, usedClosedFallback }
}

async function loadMemory(kistnummer: string) {
  const { data, error } = await supabaseAdmin
    .from('grote_inpak_ai_memory')
    .select('*')
    .eq('subject_type', 'case_type')
    .eq('subject_key', normalizeCode(kistnummer))
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    console.warn('AI-geheugen niet beschikbaar voor kiststatus:', error.message)
    return []
  }
  return data || []
}

async function rememberStatus(kistnummer: string, floorStatus: PoFloorStatusValue, note: string | null) {
  const subjectKey = normalizeCode(kistnummer)
  const row = {
    subject_type: 'case_type',
    subject_key: subjectKey,
    memory_type: 'production_status',
    value: poFloorStatusLabel(floorStatus),
    note,
    source: 'ai_assistant',
    is_active: true,
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('grote_inpak_ai_memory')
    .select('id')
    .eq('subject_type', row.subject_type)
    .eq('subject_key', row.subject_key)
    .eq('memory_type', row.memory_type)
    .eq('is_active', true)
    .maybeSingle()

  if (existingError) throw existingError

  const { error } = existing?.id
    ? await supabaseAdmin.from('grote_inpak_ai_memory').update(row).eq('id', existing.id)
    : await supabaseAdmin.from('grote_inpak_ai_memory').insert(row)

  if (error) throw error
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const kistnummer = searchParams.get('kistnummer') || searchParams.get('kist')
    const onlyOpen = searchParams.get('only_open') !== '0'

    if (!kistnummer) {
      return NextResponse.json({ error: 'kistnummer is verplicht' }, { status: 400 })
    }

    const [ordersResult, memory] = await Promise.all([
      loadOrders(kistnummer, onlyOpen),
      loadMemory(kistnummer),
    ])
    const orders = ordersResult.rows

    const openOrders = orders.filter((row) => Number(row.remaining_quantity ?? 0) > 0)
    const earliestEnding = openOrders.find((row) => row.ending_date)?.ending_date || orders.find((row) => row.ending_date)?.ending_date || null
    const activeFloorStatuses = Array.from(new Set(orders.map((row) => row.floor_status).filter(Boolean)))
    const primaryOrder = openOrders.find((row) => row.ending_date) || openOrders[0] || orders.find((row) => row.ending_date) || orders[0] || null

    return NextResponse.json({
      success: true,
      kistnummer: normalizeCode(kistnummer),
      orders: orders.map(sanitizeOrder),
      memory,
      summary: {
        total_orders: orders.length,
        open_orders: openOrders.length,
        remaining_total: openOrders.reduce((sum, row) => sum + Number(row.remaining_quantity ?? 0), 0),
        earliest_ending: earliestEnding,
        used_closed_fallback: ordersResult.usedClosedFallback,
        primary_order: primaryOrder ? sanitizeOrder(primaryOrder) : null,
        floor_statuses: activeFloorStatuses.map((value) => ({
          value,
          label: poFloorStatusLabel(value),
        })),
      },
    })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/production-orders/kist-status',
      method: 'GET',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kiststatus ophalen mislukt.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = statusRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ongeldige kiststatus aanvraag.' }, { status: 400 })
    }

    const floorStatus = normalizeStatus(parsed.data.floor_status)
    if (!floorStatus) {
      return NextResponse.json({ error: 'Ongeldige vloerstatus.' }, { status: 400 })
    }

    const kistnummer = normalizeCode(parsed.data.kistnummer)
    const note = parsed.data.note?.trim() || null
    const ordersResult = await loadOrders(kistnummer, parsed.data.only_open)
    const orders = ordersResult.rows
    const now = new Date().toISOString()
    const rows = orders.map((order) => ({
      prod_order_no: order.prod_order_no,
      item_no: order.item_no,
      bc_source: order.bc_source || 'bc36',
      floor_status: floorStatus,
      note,
      updated_at: now,
    }))

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('grote_inpak_production_order_floor_status')
        .upsert(rows, { onConflict: 'prod_order_no,item_no,bc_source' })

      if (error) throw error
    }

    if (parsed.data.remember) {
      await rememberStatus(kistnummer, floorStatus, note)
    }

    const refreshed = await loadOrders(kistnummer, parsed.data.only_open)

    return NextResponse.json({
      success: true,
      kistnummer,
      floor_status: floorStatus,
      floor_status_label: poFloorStatusLabel(floorStatus),
      updated_orders: rows.length,
      orders: refreshed.rows.map(sanitizeOrder),
      remembered: parsed.data.remember,
    })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/production-orders/kist-status',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kiststatus opslaan mislukt.' },
      { status: 500 }
    )
  }
}
