import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items = Array.isArray(body) ? body : [body]

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array.' },
        { status: 400 }
      )
    }

    // Validate and prepare data
    const validItems = items
      .map((item) => ({
        item_number: item.item_number?.toString().trim() || null,
        po_number: item.po_number?.toString().trim() || null,
        amount: item.amount ? Number(item.amount) : null,
        wms_line_id: item.wms_line_id?.toString().trim() || null,
        wms_import_date: new Date().toISOString(),
      }))
      .filter(
        (item) => item.item_number && item.po_number && item.amount && item.amount > 0
      )

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to import.' },
        { status: 400 }
      )
    }

    let inserted = 0
    let skipped = 0
    let errors = 0

    // Process items one by one to handle duplicates gracefully
    for (const item of validItems) {
      try {
        // Check if item with this wms_line_id already exists
        if (item.wms_line_id) {
          const { data: existing } = await supabaseAdmin
            .from('items_to_pack')
            .select('id')
            .eq('wms_line_id', item.wms_line_id)
            .single()

          if (existing) {
            skipped++
            continue
          }
        }

        // Check if item already exists (fallback: same item_number + po_number + not packed)
        // This is a secondary check in case wms_line_id is missing
        if (!item.wms_line_id) {
          const { data: existing } = await supabaseAdmin
            .from('items_to_pack')
            .select('id')
            .eq('item_number', item.item_number)
            .eq('po_number', item.po_number)
            .eq('packed', false)
            .single()

          if (existing) {
            skipped++
            continue
          }
        }

        // Insert new item
        const { error: insertError } = await supabaseAdmin
          .from('items_to_pack')
          .insert(item)

        if (insertError) {
          // If it's a unique constraint violation, count as skipped
          if (insertError.code === '23505') {
            skipped++
          } else {
            console.error('Error inserting item:', insertError)
            errors++
          }
        } else {
          inserted++
        }
      } catch (error) {
        console.error('Error processing item:', error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      errors,
      total: validItems.length,
      message: `Import completed: ${inserted} inserted, ${skipped} skipped, ${errors} errors`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

