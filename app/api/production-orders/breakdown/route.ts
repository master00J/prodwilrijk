import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const getMaterialCostForComponent = (component: any, price: number, unitOfMeasure: string) => {
  const unitCount = Number(component.component_unit) || 0
  if (unitOfMeasure === 'm3') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const thickness = Number(component.component_thickness) || 0
    const volume = (length * width * thickness) / 1_000_000_000
    return volume * unitCount * price
  }
  if (unitOfMeasure === 'm2') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const area = (length * width) / 1_000_000
    return area * unitCount * price
  }
  return unitCount * price
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemNumber = searchParams.get('item_number')

    if (!itemNumber) {
      return NextResponse.json(
        { error: 'item_number is required' },
        { status: 400 }
      )
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select(
        `
          id,
          line_no,
          item_number,
          description,
          quantity,
          production_order_id,
          production_orders (order_number, uploaded_at),
          production_order_components (
            component_item_no,
            component_description,
            component_description_2,
            component_unit,
            component_length,
            component_width,
            component_thickness
          )
        `
      )
      .eq('item_number', itemNumber)
      .order('production_orders(uploaded_at)', { ascending: false })

    if (linesError) {
      throw linesError
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({ item_number: itemNumber, lines: [] })
    }

    const latestUploadedAt =
      (Array.isArray(lines[0]?.production_orders)
        ? lines[0]?.production_orders?.[0]?.uploaded_at
        : lines[0]?.production_orders?.uploaded_at) || null
    const latestLines = latestUploadedAt
      ? lines.filter((line: any) => {
          const uploadedAt = Array.isArray(line.production_orders)
            ? line.production_orders?.[0]?.uploaded_at
            : line.production_orders?.uploaded_at
          return uploadedAt === latestUploadedAt
        })
      : lines

    const componentItemNumbers = new Set<string>()
    latestLines.forEach((line: any) => {
      const components = line.production_order_components || []
      components.forEach((component: any) => {
        if (component.component_item_no) {
          componentItemNumbers.add(component.component_item_no)
        }
      })
    })

    let materialPriceMap: Record<string, number> = {}
    let materialUnitMap: Record<string, string> = {}
    if (componentItemNumbers.size > 0) {
      const { data: materialPrices, error: materialError } = await supabaseAdmin
        .from('material_prices')
        .select('item_number, price, unit_of_measure')
        .in('item_number', Array.from(componentItemNumbers))

      if (materialError) {
        throw materialError
      }

      materialPrices?.forEach((item: any) => {
        materialPriceMap[item.item_number] = Number(item.price) || 0
        if (item.unit_of_measure) {
          materialUnitMap[item.item_number] = String(item.unit_of_measure).trim()
        }
      })
    }

    const breakdownLines = latestLines.map((line: any) => {
      const components = (line.production_order_components || []).map((component: any) => {
        const componentItemNo = component.component_item_no
        const price = componentItemNo ? materialPriceMap[componentItemNo] : undefined
        const unitOfMeasure = componentItemNo ? materialUnitMap[componentItemNo] || 'stuks' : 'stuks'
        const cost =
          price !== undefined ? getMaterialCostForComponent(component, price, unitOfMeasure) : 0

        return {
          component_item_no: componentItemNo,
          description: component.component_description || component.component_description_2 || null,
          unit_of_measure: unitOfMeasure,
          price,
          unit_count: Number(component.component_unit) || 0,
          length: Number(component.component_length) || 0,
          width: Number(component.component_width) || 0,
          thickness: Number(component.component_thickness) || 0,
          cost,
        }
      })

      const totalCost = components.reduce((sum: number, component: any) => sum + (component.cost || 0), 0)

      return {
        line_no: line.line_no,
        description: line.description,
        quantity: Number(line.quantity) || 0,
        order_number: Array.isArray(line.production_orders)
          ? line.production_orders?.[0]?.order_number || null
          : line.production_orders?.order_number || null,
        uploaded_at: Array.isArray(line.production_orders)
          ? line.production_orders?.[0]?.uploaded_at || null
          : line.production_orders?.uploaded_at || null,
        components,
        cost_per_item: totalCost,
      }
    })

    return NextResponse.json({
      item_number: itemNumber,
      lines: breakdownLines,
    })
  } catch (error: any) {
    console.error('Error fetching production order breakdown:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen BOM detail' },
      { status: 500 }
    )
  }
}
