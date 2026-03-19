import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/update_bodem_stock - Update bodems stock (compatibility route)
// This is an alias for /api/cnh/bodems-stock for backward compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, quantity, operation } = body

    if (!type || (type !== 'laag' && type !== 'hoog')) {
      return NextResponse.json(
        { error: 'type must be "laag" or "hoog"' },
        { status: 400 }
      )
    }

    if (typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'quantity must be a number' },
        { status: 400 }
      )
    }

    // Get current stock
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('bodems_stock')
      .select('quantity')
      .eq('type', type)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current stock:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch current stock' },
        { status: 500 }
      )
    }

    const currentQuantity = current?.quantity || 0
    let newQuantity = currentQuantity

    if (operation === 'add') {
      newQuantity = currentQuantity + quantity
    } else if (operation === 'subtract') {
      newQuantity = Math.max(0, currentQuantity - quantity)
    } else if (operation === 'set') {
      newQuantity = quantity
    } else {
      return NextResponse.json(
        { error: 'operation must be "add", "subtract", or "set"' },
        { status: 400 }
      )
    }

    // Upsert stock
    const { data, error } = await supabaseAdmin
      .from('bodems_stock')
      .upsert(
        {
          type,
          quantity: newQuantity,
        },
        {
          onConflict: 'type',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error updating stock:', error)
      return NextResponse.json(
        { error: 'Failed to update stock' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      stock: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

