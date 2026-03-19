import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order, lines } = body

    if (!order?.order_number || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'Ongeldige data. Order en lijnen zijn verplicht.' },
        { status: 400 }
      )
    }

    // Replace existing order if it exists
    const { data: existingOrder } = await supabaseAdmin
      .from('production_orders')
      .select('id')
      .eq('order_number', order.order_number)
      .maybeSingle()

    if (existingOrder?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from('production_orders')
        .delete()
        .eq('id', existingOrder.id)

      if (deleteError) {
        throw deleteError
      }
    }

    const { data: createdOrder, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .insert({
        order_number: order.order_number,
        sales_order_number: order.sales_order_number || null,
        creation_date: order.creation_date || null,
        due_date: order.due_date || null,
        starting_date: order.starting_date || null,
        source_file_name: order.source_file_name || null,
      })
      .select()
      .single()

    if (orderError || !createdOrder) {
      throw orderError || new Error('Failed to create production order')
    }

    const linesToInsert = lines.map((line: any) => ({
      production_order_id: createdOrder.id,
      line_no: line.line_no ?? null,
      item_no: line.item_no ?? null,
      variant_code: line.variant_code ?? null,
      description: line.description ?? null,
      description_2: line.description_2 ?? null,
      quantity: line.quantity ?? null,
      inside_mass: line.inside_mass ?? null,
      outside_mass: line.outside_mass ?? null,
      item_number: line.item_number ?? null,
    }))

    const { data: insertedLines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .insert(linesToInsert)
      .select('id, line_no')

    if (linesError || !insertedLines) {
      throw linesError || new Error('Failed to insert production order lines')
    }

    const lineIdMap = new Map<number, number>()
    insertedLines.forEach((line, index) => {
      if (line.line_no !== null && line.line_no !== undefined) {
        lineIdMap.set(Number(line.line_no), line.id)
      } else {
        lineIdMap.set(index + 1, line.id)
      }
    })

    const componentsToInsert = lines.flatMap((line: any, index: number) => {
      const lineId = lineIdMap.get(Number(line.line_no ?? index + 1))
      if (!lineId || !Array.isArray(line.components)) return []
      return line.components.map((component: any) => ({
        production_order_line_id: lineId,
        component_line_no: component.component_line_no ?? null,
        component_item_no: component.component_item_no ?? null,
        component_description: component.component_description ?? null,
        component_description_2: component.component_description_2 ?? null,
        component_length: component.component_length ?? null,
        component_width: component.component_width ?? null,
        component_thickness: component.component_thickness ?? null,
        component_unit: component.component_unit ?? null,
        component_group: component.component_group ?? null,
        component_group_sortvalue: component.component_group_sortvalue ?? null,
        component_indentation: component.component_indentation ?? null,
        component_margin: component.component_margin ?? null,
        fsg_group_code: component.fsg_group_code ?? null,
        fsg_group_description: component.fsg_group_description ?? null,
        fsg_unit: component.fsg_unit ?? null,
        fsg_unit_expected: component.fsg_unit_expected ?? null,
        fsg_total_volume: component.fsg_total_volume ?? null,
      }))
    })

    if (componentsToInsert.length > 0) {
      const chunks = chunkArray(componentsToInsert, 1000)
      for (const chunk of chunks) {
        const { error: componentsError } = await supabaseAdmin
          .from('production_order_components')
          .insert(chunk)

        if (componentsError) {
          throw componentsError
        }
      }
    }

    return NextResponse.json({
      success: true,
      order_number: createdOrder.order_number,
      line_count: insertedLines.length,
    })
  } catch (error: any) {
    console.error('Error uploading production order:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij uploaden productieorder' },
      { status: 500 }
    )
  }
}
