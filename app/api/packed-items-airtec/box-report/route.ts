import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    const buildQuery = () => {
      let query = supabaseAdmin
        .from('packed_items_airtec')
        .select('kistnummer, quantity')

      // Apply date filters
      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        query = query.gte('date_packed', fromDate.toISOString())
      }

      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        query = query.lte('date_packed', toDate.toISOString())
      }

      return query
    }

    const pageSize = 1000
    let from = 0
    const items: Array<{ kistnummer: string | null; quantity: number | null }> = []
    let hasMore = true
    let safety = 0
    while (hasMore) {
      const { data: page, error } = await buildQuery().range(from, from + pageSize - 1)
      if (error) {
        console.error('Error fetching packed items airtec:', error)
        return NextResponse.json(
          { error: 'Failed to fetch packed items' },
          { status: 500 }
        )
      }

      const batch = page || []
      items.push(...batch)
      if (batch.length < pageSize) {
        hasMore = false
      } else {
        from += pageSize
      }

      safety += 1
      if (safety > 200) {
        console.warn('Box report paging safety stop triggered.')
        hasMore = false
      }
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        report: [],
        message: 'No packed items found for the selected date range',
      })
    }

    // Group by kistnummer and calculate totals
    const boxMap = new Map<string, { total_quantity: number; item_count: number }>()

    items.forEach((item) => {
      if (item.kistnummer) {
        const kistnummer = String(item.kistnummer).trim()
        if (!boxMap.has(kistnummer)) {
          boxMap.set(kistnummer, { total_quantity: 0, item_count: 0 })
        }
        const boxData = boxMap.get(kistnummer)!
        boxData.total_quantity += item.quantity || 0
        boxData.item_count += 1
      }
    })

    // Get ERP codes from airtec_prices table
    const kistnummers = Array.from(boxMap.keys())
    const { data: prices, error: pricesError } = await supabaseAdmin
      .from('airtec_prices')
      .select('kistnummer, erp_code')
      .in('kistnummer', kistnummers)

    // Create a map of kistnummer to erp_code
    const erpCodeMap = new Map<string, string>()
    if (prices && !pricesError) {
      prices.forEach((price) => {
        erpCodeMap.set(String(price.kistnummer), price.erp_code || '')
      })
    }

    // Build report array
    const report = Array.from(boxMap.entries())
      .map(([kistnummer, data]) => ({
        kistnummer,
        total_quantity: data.total_quantity,
        item_count: data.item_count,
        erp_code: erpCodeMap.get(kistnummer) || null,
      }))
      .sort((a, b) => a.kistnummer.localeCompare(b.kistnummer))

    return NextResponse.json({
      report,
      totalBoxes: report.length,
      totalQuantity: report.reduce((sum, item) => sum + item.total_quantity, 0),
    })
  } catch (error: any) {
    console.error('Error generating box report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}

