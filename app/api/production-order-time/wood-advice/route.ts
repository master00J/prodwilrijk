import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'
import { KNOWN_WOOD_TYPE_PREFIXES } from '@/lib/wood/houtsoort-codes'
import { normalizeSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'

const KNOWN_WOOD_TYPES = [...KNOWN_WOOD_TYPE_PREFIXES]
const STANDARD_LENGTHS = [2440, 2500, 3050, 3660, 4000, 4880, 5000, 6100]

type Requirement = {
  key: string
  houtsoort: string
  dikte: number
  breedte: number
  lengte: number
  required: number
  source_orders: string[]
  component_refs: string[]
}

type StockBucket = {
  houtsoort: string
  dikte: number
  breedte: number
  lengte: number
  locatie: string
  available: number
}

const norm = (value: unknown) => String(value || '').trim().toUpperCase()
const num = (value: unknown) => Number(value) || 0
const dimensionEqual = (a: number, b: number) => Math.abs(a - b) < 0.01

function detectWoodType(...values: unknown[]) {
  const haystack = values.map(value => norm(value)).join(' ')
  return KNOWN_WOOD_TYPES.find(type => haystack.includes(type)) || null
}

function makeKey(houtsoort: string, dikte: number, breedte: number, lengte: number) {
  return `${norm(houtsoort)}|${dikte}|${breedte}|${lengte}`
}

function recommendLength(requiredLength: number) {
  return STANDARD_LENGTHS.find(length => length >= requiredLength) || requiredLength
}

export async function GET(request: NextRequest) {
  try {
    const orderNumber = request.nextUrl.searchParams.get('order_number')
    const site = normalizeSite(request.nextUrl.searchParams.get('site'))

    let orderQuery = supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, uploaded_at, finished_at')
      .eq('for_time_registration', true)
      .eq('site', site)
      .order('uploaded_at', { ascending: false })

    if (orderNumber) {
      orderQuery = orderQuery.eq('order_number', orderNumber)
    } else {
      orderQuery = orderQuery.is('finished_at', null)
    }

    const { data: orders, error: orderError } = await orderQuery
    if (orderError) throw orderError
    if (!orders?.length) {
      return NextResponse.json({ summary: { groups: 0, shortage_groups: 0, total_shortage: 0 }, requirements: [] })
    }

    const { data: bcRows } = await supabaseAdmin
      .from('bc_codes')
      .select('bc_code, houtsoort, dikte, breedte')

    const bcByCode = new Map<string, { houtsoort: string; dikte: number; breedte: number }>()
    ;(bcRows || []).forEach((row: any) => {
      if (!row.bc_code) return
      bcByCode.set(norm(row.bc_code), {
        houtsoort: String(row.houtsoort || '').trim(),
        dikte: num(row.dikte),
        breedte: num(row.breedte),
      })
    })

    const requirements = new Map<string, Requirement>()

    for (const order of orders) {
      const { data: lines, error: linesError } = await supabaseAdmin
        .from('production_order_lines')
        .select(
          `
          id, item_number, description, description_2, quantity,
          production_order_components (
            id, component_item_no, component_description, component_description_2,
            component_unit, component_length, component_width, component_thickness,
            fsg_group_code, fsg_group_description
          )
        `
        )
        .eq('production_order_id', order.id)

      if (linesError) throw linesError

      ;(lines || []).forEach((line: any) => {
        const lineQty = Math.max(0, num(line.quantity))
        ;(line.production_order_components || []).forEach((component: any) => {
          const length = Math.round(num(component.component_length))
          const width = num(component.component_width)
          const thickness = num(component.component_thickness)
          const unit = num(component.component_unit)
          if (length <= 0 || width <= 0 || thickness <= 0 || unit <= 0 || lineQty <= 0) return

          const itemNo = norm(component.component_item_no)
          const bcMatch = bcByCode.get(itemNo)
          const groupText = `${component.fsg_group_code || ''} ${component.fsg_group_description || ''}`.toLowerCase()
          const detectedWood = detectWoodType(
            component.component_item_no,
            component.component_description,
            component.component_description_2
          )

          if (!bcMatch && !groupText.includes('hout') && !detectedWood) return

          const houtsoort = bcMatch?.houtsoort || detectedWood || 'Onbekend'
          const dikte = bcMatch?.dikte || thickness
          const breedte = bcMatch?.breedte || width
          const required = Math.ceil(unit * lineQty)
          const key = makeKey(houtsoort, dikte, breedte, length)
          const existing = requirements.get(key)
          const ref = `${order.order_number} / ${line.item_number || line.description || 'lijn'}`

          if (existing) {
            existing.required += required
            if (!existing.source_orders.includes(order.order_number)) existing.source_orders.push(order.order_number)
            existing.component_refs.push(ref)
          } else {
            requirements.set(key, {
              key,
              houtsoort,
              dikte,
              breedte,
              lengte: length,
              required,
              source_orders: [order.order_number],
              component_refs: [ref],
            })
          }
        })
      })
    }

    const { data: stockRows, error: stockError } = await supabaseAdmin
      .from('wood_stock')
      .select('houtsoort, dikte, breedte, lengte, locatie, aantal')
      .gt('aantal', 0)

    if (stockError) throw stockError

    const stockBuckets: StockBucket[] = []
    ;(stockRows || []).forEach((row: any) => {
      stockBuckets.push({
        houtsoort: String(row.houtsoort || '').trim(),
        dikte: num(row.dikte),
        breedte: num(row.breedte),
        lengte: Math.round(num(row.lengte)),
        locatie: String(row.locatie || 'Onbekend'),
        available: Math.max(0, Math.floor(num(row.aantal))),
      })
    })

    const advice = Array.from(requirements.values())
      .sort((a, b) => a.houtsoort.localeCompare(b.houtsoort) || a.dikte - b.dikte || a.breedte - b.breedte || a.lengte - b.lengte)
      .map(req => {
        let remaining = req.required
        const matchingStock = stockBuckets
          .filter(stock =>
            norm(stock.houtsoort) === norm(req.houtsoort) &&
            dimensionEqual(stock.dikte, req.dikte) &&
            dimensionEqual(stock.breedte, req.breedte) &&
            stock.lengte >= req.lengte &&
            stock.available > 0
          )
          .sort((a, b) => a.lengte - b.lengte || a.locatie.localeCompare(b.locatie))

        const allocations: Array<{ lengte: number; locatie: string; quantity: number; waste_mm_per_piece: number; total_waste_mm: number }> = []

        for (const stock of matchingStock) {
          if (remaining <= 0) break
          const quantity = Math.min(remaining, stock.available)
          if (quantity <= 0) continue
          remaining -= quantity
          stock.available -= quantity
          allocations.push({
            lengte: stock.lengte,
            locatie: stock.locatie,
            quantity,
            waste_mm_per_piece: stock.lengte - req.lengte,
            total_waste_mm: (stock.lengte - req.lengte) * quantity,
          })
        }

        return {
          ...req,
          available_matching: req.required - remaining,
          shortage: remaining,
          allocations,
          recommended_order_length: remaining > 0 ? recommendLength(req.lengte) : null,
          status: remaining > 0 ? 'Tekort' : 'Gedekt',
        }
      })

    return NextResponse.json({
      summary: {
        groups: advice.length,
        shortage_groups: advice.filter(item => item.shortage > 0).length,
        total_shortage: advice.reduce((sum, item) => sum + item.shortage, 0),
      },
      requirements: advice,
    })
  } catch (error: any) {
    logApiError(error, { route: '/api/production-order-time/wood-advice', method: 'GET' })
    return NextResponse.json(
      { error: error.message || 'Fout bij berekenen houtadvies' },
      { status: 500 }
    )
  }
}
