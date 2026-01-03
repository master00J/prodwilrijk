import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const caseLabel = searchParams.get('case_label')

    let query = supabaseAdmin
      .from('grote_inpak_packed')
      .select('*')
      .order('packed_date', { ascending: false })

    if (caseLabel) {
      query = query.eq('case_label', caseLabel)
    }

    if (dateFrom) {
      query = query.gte('packed_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('packed_date', dateTo)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ data: data || [], count: data?.length || 0 })
  } catch (error: any) {
    console.error('Error fetching packed items:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching packed data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { packedData } = body

    if (!Array.isArray(packedData)) {
      return NextResponse.json(
        { error: 'packedData must be an array' },
        { status: 400 }
      )
    }

    // Insert packed data
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_packed')
      .insert(packedData)
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error: any) {
    console.error('Error saving packed items:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving packed data' },
      { status: 500 }
    )
  }
}

