import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemNumber = searchParams.get('item_number')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabaseAdmin
      .from('grote_inpak_forecast')
      .select('*')
      .order('forecast_date', { ascending: true })

    if (itemNumber) {
      query = query.eq('item_number', itemNumber)
    }

    if (dateFrom) {
      query = query.gte('forecast_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('forecast_date', dateTo)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ data: data || [], count: data?.length || 0 })
  } catch (error: any) {
    console.error('Error fetching forecast:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching forecast data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { forecastData } = body

    if (!Array.isArray(forecastData)) {
      return NextResponse.json(
        { error: 'forecastData must be an array' },
        { status: 400 }
      )
    }

    // Upsert forecast data
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .upsert(forecastData, {
        onConflict: 'item_number,forecast_date',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error: any) {
    console.error('Error saving forecast:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving forecast data' },
      { status: 500 }
    )
  }
}

