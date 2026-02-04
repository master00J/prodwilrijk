import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const getUnitCost = (component: any, price: number, unit: string) => {
  const unitValue = Number(component.component_unit) || 0
  if (unit === 'm3') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const thickness = Number(component.component_thickness) || 0
    const volume = (length * width * thickness) / 1_000_000_000
    return volume * unitValue * price
  }
  if (unit === 'm2') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const area = (length * width) / 1_000_000
    return area * unitValue * price
  }
  return unitValue * price
}

/** Returns all production orders with for_time_registration=true including material cost breakdown. */
export async function GET() {
  try {
    const { data: orders, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, uploaded_at')
      .eq('for_time_registration', true)
      .order('uploaded_at', { ascending: false })

    if (orderError) throw orderError
    if (!orders?.length) {
      return NextResponse.json({ orders: [] })
    }

    const result: any[] = []

    for (const order of orders) {
      const { data: lines, error: linesError } = await supabaseAdmin
        .from('production_order_lines')
        .select(
          `
          id, line_no, item_no, item_number, description, description_2, quantity, sales_price,
          production_order_components (
            id, component_item_no, component_description, component_description_2,
            component_unit, component_length, component_width, component_thickness
          )
        `
        )
        .eq('production_order_id', order.id)
        .order('line_no', { ascending: true })

      if (linesError) throw linesError

      const componentItems = new Map<string, { description: string | null; usageCount: number }>()
      const componentItemNumbers = new Set<string>()

      ;(lines || []).forEach((line: any) => {
        const components = line.production_order_components || []
        components.forEach((component: any) => {
          const itemNo = component.component_item_no
          if (!itemNo) return
          componentItemNumbers.add(itemNo)
          const existing = componentItems.get(itemNo)
          if (existing) {
            existing.usageCount += 1
          } else {
            componentItems.set(itemNo, {
              description: component.component_description || component.component_description_2 || null,
              usageCount: 1,
            })
          }
        })
      })

      let priceMap: Record<string, number> = {}
      let unitMap: Record<string, string> = {}
      if (componentItemNumbers.size > 0) {
        const { data: prices } = await supabaseAdmin
          .from('material_prices')
          .select('item_number, price, description, unit_of_measure')
          .in('item_number', Array.from(componentItemNumbers))

        priceMap = (prices || []).reduce((acc: Record<string, number>, item: any) => {
          acc[item.item_number] = Number(item.price) || 0
          if (item.description && componentItems.has(item.item_number)) {
            componentItems.get(item.item_number)!.description = item.description
          }
          return acc
        }, {})

        unitMap = (prices || []).reduce((acc: Record<string, string>, item: any) => {
          if (item.unit_of_measure) acc[item.item_number] = String(item.unit_of_measure).trim()
          return acc
        }, {})
      }

      let totalMaterialCost = 0
      let missingPriceCount = 0
      let componentCount = 0

      const linesWithCost = (lines || []).map((line: any) => {
        const components = line.production_order_components || []
        let costPerItem = 0
        let missingPrice = false

        components.forEach((component: any) => {
          componentCount += 1
          const itemNo = component.component_item_no
          const price = itemNo && priceMap[itemNo] !== undefined ? priceMap[itemNo] : null
          if (price === null) {
            missingPrice = true
            return
          }
          const unitOfMeasure = itemNo && unitMap[itemNo] ? unitMap[itemNo] : 'stuks'
          costPerItem += getUnitCost(component, price, unitOfMeasure)
        })

        if (missingPrice) missingPriceCount += 1

        const quantity = Number(line.quantity) || 0
        const totalCost = costPerItem * quantity
        totalMaterialCost += totalCost

        return {
          ...line,
          cost_per_item: costPerItem,
          total_cost: totalCost,
        }
      })

      const materials = Array.from(componentItems.entries()).map(([itemNumber, meta]) => ({
        item_number: itemNumber,
        description: meta.description,
        usage_count: meta.usageCount,
        price: priceMap[itemNumber] !== undefined ? priceMap[itemNumber] : null,
        unit_of_measure: unitMap[itemNumber] || 'stuks',
      }))

      result.push({
        order: {
          ...order,
          uploaded_at: order.uploaded_at,
        },
        lines: linesWithCost,
        materials,
        totals: {
          line_count: linesWithCost.length,
          component_count: componentCount,
          total_material_cost: totalMaterialCost,
          missing_price_count: missingPriceCount,
        },
      })
    }

    return NextResponse.json({ orders: result })
  } catch (error: any) {
    console.error('Error fetching order details:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen orderdetails' },
      { status: 500 }
    )
  }
}
