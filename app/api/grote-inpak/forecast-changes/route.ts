import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const caseLabel = searchParams.get('case_label')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabaseAdmin
      .from('grote_inpak_forecast_changes')
      .select('*')
      .order('changed_at', { ascending: false })

    if (caseLabel) {
      query = query.eq('case_label', caseLabel)
    }
    if (dateFrom) {
      query = query.gte('changed_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('changed_at', dateTo)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error('Error fetching forecast changes:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching forecast changes' },
      { status: 500 }
    )
  }
}
