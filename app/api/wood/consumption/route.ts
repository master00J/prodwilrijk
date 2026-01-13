import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Get wood consumption with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDatum = searchParams.get('startDatum')
    const eindDatum = searchParams.get('eindDatum')
    const soort = searchParams.get('soort')

    let query = supabaseAdmin
      .from('wood_consumption')
      .select('*')
      .order('datum_verbruik', { ascending: false })

    if (startDatum) {
      query = query.gte('datum_verbruik', startDatum)
    }

    if (eindDatum) {
      // Add one day to include the end date
      const endDate = new Date(eindDatum)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('datum_verbruik', endDate.toISOString())
    }

    if (soort) {
      query = query.ilike('houtsoort', `%${soort}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching consumption:', error)
      return NextResponse.json(
        { error: 'Failed to fetch consumption' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



