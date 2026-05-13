import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { applyForecastSave } from '@/lib/grote-inpak/apply-forecast-save'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const caseLabel = searchParams.get('case_label')
    const caseType = searchParams.get('case_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const pageSize = 1000
    let from = 0
    const all: any[] = []

    while (true) {
      let query = supabaseAdmin
        .from('grote_inpak_forecast')
        .select('*')
        .order('arrival_date', { ascending: true })
        .order('case_label', { ascending: true })

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

      const { data, error } = await query.range(from, from + pageSize - 1)

      if (error) {
        throw error
      }

      const rows = data || []
      if (rows.length === 0) break
      all.push(...rows)
      from += rows.length
    }

    return NextResponse.json(
      { data: all, count: all.length },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' } }
    )
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
    const { forecastData, replace, uploadedFileNames } = body

    if (!Array.isArray(forecastData)) {
      return NextResponse.json(
        { error: 'forecastData must be an array' },
        { status: 400 }
      )
    }

    const result = await applyForecastSave(forecastData, Boolean(replace), {
      uploadedFileNames: Array.isArray(uploadedFileNames) ? uploadedFileNames : undefined,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (result.replace) {
      return NextResponse.json({
        success: true,
        data: result.data,
        count: result.count,
        snapshot_id: result.snapshot_id,
        changes: result.changes,
      })
    }

    return NextResponse.json({ success: true, data: result.data, count: result.count })
  } catch (error: any) {
    console.error('Error saving forecast:', error)
    return NextResponse.json(
      { error: error.message || 'Error saving forecast data' },
      { status: 500 }
    )
  }
}

