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

    // OPTIMIZED: Batch check for existing items instead of one-by-one queries
    // Only check for items imported today to prevent duplicate imports on the same day
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const todayStart = new Date(today + 'T00:00:00.000Z').toISOString()
    const todayEnd = new Date(today + 'T23:59:59.999Z').toISOString()
    
    // Get all wms_line_ids that already exist (imported today)
    const wmsLineIds = validItems
      .map(item => item.wms_line_id)
      .filter((id): id is string => id !== null && id !== undefined)
    
    let existingWmsLineIds = new Set<string>()
    if (wmsLineIds.length > 0) {
      // Batch query: get all existing wms_line_ids imported today
      const { data: existingByWmsId } = await supabaseAdmin
        .from('items_to_pack')
        .select('wms_line_id')
        .in('wms_line_id', wmsLineIds)
        .gte('wms_import_date', todayStart)
        .lte('wms_import_date', todayEnd)
      
      if (existingByWmsId) {
        existingWmsLineIds = new Set(
          existingByWmsId
            .map(item => item.wms_line_id)
            .filter((id): id is string => id !== null && id !== undefined)
        )
      }
    }

    // Get items without wms_line_id to check by item_number + po_number
    const itemsWithoutWmsId = validItems.filter(item => !item.wms_line_id)
    let existingItemPoCombos = new Set<string>()
    
    if (itemsWithoutWmsId.length > 0) {
      // Get unique item_number values to query
      const uniqueItemNumbers = [...new Set(itemsWithoutWmsId.map(item => item.item_number))]
      
      // Query for existing items with matching item_numbers, packed=false, and imported today
      // Then filter in memory for matching po_numbers
      const { data: existingByItemPo } = await supabaseAdmin
        .from('items_to_pack')
        .select('item_number, po_number')
        .in('item_number', uniqueItemNumbers)
        .eq('packed', false)
        .gte('wms_import_date', todayStart)
        .lte('wms_import_date', todayEnd)
      
      if (existingByItemPo) {
        existingItemPoCombos = new Set(
          existingByItemPo.map(item => `${item.item_number}|${item.po_number}`)
        )
      }
    }

    // Filter out items that already exist
    const itemsToInsert = validItems.filter(item => {
      // Check by wms_line_id first
      if (item.wms_line_id && existingWmsLineIds.has(item.wms_line_id)) {
        return false
      }
      
      // Check by item_number + po_number if no wms_line_id
      if (!item.wms_line_id) {
        const combo = `${item.item_number}|${item.po_number}`
        if (existingItemPoCombos.has(combo)) {
          return false
        }
      }
      
      return true
    })

    let skipped = validItems.length - itemsToInsert.length
    let inserted = 0
    let errors = 0

    // Bulk insert all new items in batches (Supabase has a limit per insert)
    const BATCH_SIZE = 1000
    for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
      const batch = itemsToInsert.slice(i, i + BATCH_SIZE)
      
      try {
        const { error: insertError } = await supabaseAdmin
          .from('items_to_pack')
          .insert(batch)

        if (insertError) {
          // If it's a unique constraint violation, try inserting one by one to identify duplicates
          if (insertError.code === '23505') {
            // Fallback: insert one by one to handle any remaining duplicates
            for (const item of batch) {
              try {
                const { error: singleInsertError } = await supabaseAdmin
                  .from('items_to_pack')
                  .insert(item)
                
                if (singleInsertError) {
                  if (singleInsertError.code === '23505') {
                    // Duplicate, skip it
                    skipped++
                  } else {
                    console.error('Error inserting item:', singleInsertError)
                    errors++
                  }
                } else {
                  inserted++
                }
              } catch (error) {
                console.error('Error inserting item:', error)
                errors++
              }
            }
          } else {
            console.error('Error inserting batch:', insertError)
            errors += batch.length
          }
        } else {
          inserted += batch.length
        }
      } catch (error) {
        console.error('Error processing batch:', error)
        errors += batch.length
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

