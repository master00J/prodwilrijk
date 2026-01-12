import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Get BC codes in bulk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      )
    }

    // Get unique items
    const uniqueItems: Array<{ breedte: number; dikte: number; houtsoort: string }> = []
    const seenKeys = new Set<string>()

    items.forEach((item: any) => {
      const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
      const key = `${item.breedte}-${item.dikte}-${houtsoort}`

      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        uniqueItems.push({
          breedte: item.breedte,
          dikte: item.dikte,
          houtsoort: item.houtsoort || ''
        })
      }
    })

    // Query BC codes from database (assuming you have a bc_codes table)
    // If the table doesn't exist yet, return empty object
    const { data: bcCodes, error } = await supabaseAdmin
      .from('bc_codes')
      .select('breedte, dikte, houtsoort, bc_code')

    if (error) {
      console.error('Error fetching BC codes:', error)
      // Return empty object if table doesn't exist
      return NextResponse.json({ bc_codes: {} })
    }

    // Create mapping
    const bcCodeMap: Record<string, string> = {}
    
    if (bcCodes) {
      bcCodes.forEach((row: any) => {
        const houtsoort = row.houtsoort ? row.houtsoort.toLowerCase() : ''
        const key = `${row.breedte}-${row.dikte}-${houtsoort}`
        bcCodeMap[key] = row.bc_code || ''
      })
    }

    return NextResponse.json({ bc_codes: bcCodeMap })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


