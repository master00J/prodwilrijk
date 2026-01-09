import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to create key for grouping (without length)
function keyFor(houtsoort: string, dikte: number, breedte: number): string {
  return `${houtsoort}-${dikte}-${breedte}`
}

// POST - Run auto-order based on target stock
export async function POST(request: NextRequest) {
  try {
    // Get target stock data
    const { data: targetStockData, error: targetError } = await supabaseAdmin
      .from('wood_target_stock')
      .select('*')

    if (targetError) {
      console.error('Error fetching target stock:', targetError)
      return NextResponse.json(
        { error: 'Failed to fetch target stock' },
        { status: 500 }
      )
    }

    if (!targetStockData || targetStockData.length === 0) {
      return NextResponse.json(
        { error: 'No target stock data found' },
        { status: 400 }
      )
    }

    // Get current stock (wood_stock) - count as packs
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from('wood_stock')
      .select('houtsoort, dikte, breedte')

    if (stockError) {
      console.error('Error fetching stock:', stockError)
      return NextResponse.json(
        { error: 'Failed to fetch stock' },
        { status: 500 }
      )
    }

    // Count current stock packs (grouped by houtsoort, dikte, breedte - all lengths count)
    const packStock = new Map<string, number>()
    if (stockData) {
      stockData.forEach((item: any) => {
        const key = keyFor(item.houtsoort, item.dikte, item.breedte)
        packStock.set(key, (packStock.get(key) || 0) + 1)
      })
    }

    // Get open orders (wood_orders where open_pakken > 0)
    const { data: openOrders, error: ordersError } = await supabaseAdmin
      .from('wood_orders')
      .select('houtsoort, dikte, breedte, open_pakken')
      .eq('gearchiveerd', false)
      .gt('open_pakken', 0)

    if (ordersError) {
      console.error('Error fetching open orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch open orders' },
        { status: 500 }
      )
    }

    // Count open order packs
    const openOrderPacks = new Map<string, number>()
    if (openOrders) {
      openOrders.forEach((order: any) => {
        const key = keyFor(order.houtsoort, order.dikte, order.breedte)
        openOrderPacks.set(key, (openOrderPacks.get(key) || 0) + order.open_pakken)
      })
    }

    // Get packages waiting for receive (wood_packages where ontvangen = false)
    const { data: waitingPackages, error: packagesError } = await supabaseAdmin
      .from('wood_packages')
      .select('houtsoort, exacte_dikte, exacte_breedte')
      .eq('ontvangen', false)

    if (packagesError) {
      console.error('Error fetching waiting packages:', packagesError)
      return NextResponse.json(
        { error: 'Failed to fetch waiting packages' },
        { status: 500 }
      )
    }

    // Count waiting packages (grouped by houtsoort, dikte, breedte)
    const waitingPacks = new Map<string, number>()
    if (waitingPackages) {
      waitingPackages.forEach((pkg: any) => {
        const key = keyFor(pkg.houtsoort, Math.round(pkg.exacte_dikte), Math.round(pkg.exacte_breedte))
        waitingPacks.set(key, (waitingPacks.get(key) || 0) + 1)
      })
    }

    // Group target stock by houtsoort/dikte/breedte (combine different lengths)
    const groupedTargets = new Map<string, {
      houtsoort: string
      dikte: number
      breedte: number
      totalTarget: number
      desiredLength: number | null
    }>()

    targetStockData.forEach((item: any) => {
      const key = keyFor(item.houtsoort, item.dikte, item.breedte)
      if (!groupedTargets.has(key)) {
        groupedTargets.set(key, {
          houtsoort: item.houtsoort,
          dikte: item.dikte,
          breedte: item.breedte,
          totalTarget: 0,
          desiredLength: item.desired_length || null
        })
      }
      const group = groupedTargets.get(key)!
      group.totalTarget += item.target_packs || 0
      if (item.desired_length && !group.desiredLength) {
        group.desiredLength = item.desired_length
      }
    })

    // Calculate shortages and create orders
    const createdOrders: any[] = []
    const DEFAULT_PLANKS_PER_PACK = 50

    for (const [key, group] of groupedTargets.entries()) {
      const { houtsoort, dikte, breedte, totalTarget, desiredLength } = group

      if (totalTarget <= 0) continue

      // Get current packs
      const currentPacks = packStock.get(key) || 0
      const openPacks = openOrderPacks.get(key) || 0
      const waitingPacksCount = waitingPacks.get(key) || 0

      // For NHV: also count SXT as available stock
      let total = currentPacks + openPacks + waitingPacksCount
      if (houtsoort === 'NHV') {
        const sxtKey = keyFor('SXT', dikte, breedte)
        const sxtCurrentPacks = packStock.get(sxtKey) || 0
        const sxtOpenPacks = openOrderPacks.get(sxtKey) || 0
        const sxtWaitingPacks = waitingPacks.get(sxtKey) || 0
        total += sxtCurrentPacks + sxtOpenPacks + sxtWaitingPacks
      }

      const shortage = totalTarget - total
      if (shortage > 0) {
        // Determine min_length
        let minLength = desiredLength
        if (!minLength) {
          minLength = dikte >= 50 ? 3050 : 2440
        }

        // Create order
        const { data: newOrder, error: orderError } = await supabaseAdmin
          .from('wood_orders')
          .insert({
            houtsoort,
            dikte: Math.round(dikte),
            breedte: Math.round(breedte),
            min_lengte: minLength,
            aantal_pakken: shortage,
            planken_per_pak: DEFAULT_PLANKS_PER_PACK,
            opmerkingen: 'Auto-bestelling doelvoorraad',
            priority: false,
          })
          .select()
          .single()

        if (orderError) {
          console.error(`Error creating order for ${key}:`, orderError)
          continue
        }

        createdOrders.push(newOrder)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdOrders.length} orders`,
      orders: createdOrders
    })
  } catch (error) {
    console.error('Error in auto-order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

