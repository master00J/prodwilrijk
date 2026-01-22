import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const parseFlexibleNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/\s/g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemNumbers = searchParams.get('item_numbers')
    const query = supabaseAdmin.from('material_prices').select('*').order('item_number')

    if (itemNumbers) {
      const list = itemNumbers
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      if (list.length > 0) {
        query.in('item_number', list)
      }
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching material prices:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen prijzen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Geen prijzen om op te slaan.' },
        { status: 400 }
      )
    }

    const payload = items
      .map((item: any) => {
        const itemNumber = item.item_number ? String(item.item_number).trim() : null
        const price = parseFlexibleNumber(item.price)
        if (!itemNumber || price === null || price < 0) return null

        const entry: any = {
          item_number: itemNumber,
          price,
          description: item.description ? String(item.description).trim() : null,
          updated_at: new Date().toISOString(),
        }

        if (item.unit_of_measure !== undefined && item.unit_of_measure !== null) {
          entry.unit_of_measure = String(item.unit_of_measure).trim()
        }

        return entry
      })
      .filter(Boolean)

    if (payload.length === 0) {
      return NextResponse.json(
        { error: 'Geen geldige prijzen gevonden.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('material_prices')
      .upsert(payload, { onConflict: 'item_number' })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data?.length || payload.length,
    })
  } catch (error: any) {
    console.error('Error saving material prices:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij opslaan prijzen' },
      { status: 500 }
    )
  }
}
