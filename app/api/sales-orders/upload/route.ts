import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { salesOrdersSupportsUnitCost } from '@/lib/prepack/sales-orders-schema'

export const dynamic = 'force-dynamic'

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array of items.' },
        { status: 400 }
      )
    }

    const includeUnitCost = await salesOrdersSupportsUnitCost()

    type SalesOrderInsert = {
      item_number: string
      price: number
      description: string | null
      unit_cost?: number | null
    }

    const validItems = items
      .map((item: any) => {
        const itemNumber = item.item_number?.toString().trim()
        const price = item.price ? parseFloat(item.price) : null
        const unitCost =
          item.unit_cost !== null && item.unit_cost !== undefined && item.unit_cost !== ''
            ? parseFloat(item.unit_cost)
            : null

        if (!itemNumber || price === null || isNaN(price) || price < 0) {
          return null
        }

        const row: SalesOrderInsert = {
          item_number: itemNumber,
          price: price,
          description: item.description || null,
        }

        if (includeUnitCost) {
          row.unit_cost =
            unitCost !== null && !isNaN(unitCost) && unitCost >= 0 ? unitCost : null
        }

        return row
      })
      .filter((item: SalesOrderInsert | null): item is SalesOrderInsert => item !== null)

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid items to insert. Please check that all items have item_number and price.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sales_orders')
      .insert(validItems)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to insert sales orders: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validItems.length,
      message: `Successfully inserted ${data?.length || validItems.length} sales orders`,
      warning: includeUnitCost
        ? undefined
        : 'Kolom unit_cost ontbreekt in de database — alleen prijs opgeslagen. Voer migratie 20260521_sales_orders_unit_cost.sql uit in Supabase.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
