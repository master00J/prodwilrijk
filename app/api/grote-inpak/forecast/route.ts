import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const caseLabel = searchParams.get('case_label')
    const caseType = searchParams.get('case_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabaseAdmin
      .from('grote_inpak_forecast')
      .select('*')
      .order('arrival_date', { ascending: true })

    if (caseLabel) {
      query = query.eq('case_label', caseLabel)
    }

    if (caseType) {
      query = query.eq('case_type', caseType)
    }

    if (dateFrom) {
      query = query.gte('arrival_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('arrival_date', dateTo)
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
    const { forecastData, replace } = body

    if (!Array.isArray(forecastData)) {
      return NextResponse.json(
        { error: 'forecastData must be an array' },
        { status: 400 }
      )
    }

    const dedupedMap = new Map<string, any>()
    forecastData.forEach((row: any) => {
      const label = String(row.case_label || '').trim()
      if (!label) return
      const arrivalDate = String(row.arrival_date || '').trim()
      const existing = dedupedMap.get(label)
      if (!existing) {
        dedupedMap.set(label, { ...row, case_label: label })
        return
      }
      if (arrivalDate) {
        const currentDate = new Date(existing.arrival_date)
        const newDate = new Date(arrivalDate)
        if (!Number.isNaN(newDate.getTime()) && (Number.isNaN(currentDate.getTime()) || newDate > currentDate)) {
          dedupedMap.set(label, { ...row, case_label: label })
        }
      }
    })

    const deduped = Array.from(dedupedMap.values())

    if (replace) {
      const { error: deleteError } = await supabaseAdmin
        .from('grote_inpak_forecast')
        .delete()
        .not('id', 'is', null)

      if (deleteError) {
        throw deleteError
      }
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .upsert(deduped, {
        onConflict: 'case_label',
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

