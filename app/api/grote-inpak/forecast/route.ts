import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { applyForecastSave } from '@/lib/grote-inpak/apply-forecast-save'
import {
  excludeForecastRowsOnPils,
  filterRowsByArrivalDate,
  loadPilsCaseLabels,
  loadPilsOnlyCases,
} from '@/lib/grote-inpak/load-pils-case-labels'

export const dynamic = 'force-dynamic'

const ACTIVE_CUSTOMER_REQUEST_STATUSES = ['open', 'waiting_forecast', 'on_pils']

async function loadCustomerRequestsByCaseLabel(caseLabels: string[]) {
  const uniqueLabels = [...new Set(caseLabels.map(label => String(label || '').trim()).filter(Boolean))]
  const requestsByLabel = new Map<string, any[]>()
  const batchSize = 500

  for (let i = 0; i < uniqueLabels.length; i += batchSize) {
    const batch = uniqueLabels.slice(i, i + batchSize)
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_customer_requests')
      .select('*')
      .in('case_label', batch)
      .in('status', ACTIVE_CUSTOMER_REQUEST_STATUSES)
      .order('created_at', { ascending: false })

    if (error) throw error

    ;(data || []).forEach((request: any) => {
      const label = String(request.case_label || '').trim()
      if (!label) return
      requestsByLabel.set(label, [...(requestsByLabel.get(label) || []), request])
    })
  }

  return requestsByLabel
}

function attachCustomerRequests<T extends Record<string, any>>(
  row: T,
  requestsByLabel: Map<string, any[]>,
  onPils: boolean
) {
  const label = String(row.case_label || '').trim()
  const customerRequests = label ? (requestsByLabel.get(label) || []) : []
  return {
    ...row,
    customer_requests: customerRequests,
    open_customer_requests_count: customerRequests.length,
    customer_request_followup_status: customerRequests.length === 0
      ? null
      : onPils ? 'on_pils' : 'waiting_forecast',
  }
}

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

    const pilsLabels = await loadPilsCaseLabels()
    const { excludedOnPils } = excludeForecastRowsOnPils(all, pilsLabels)

    const forecastLabelSet = new Set(
      all.map(row => String(row.case_label || '').trim()).filter(Boolean)
    )
    let pilsOnly = await loadPilsOnlyCases(forecastLabelSet)
    pilsOnly = filterRowsByArrivalDate(pilsOnly, dateFrom, dateTo).map(row => ({
      ...row,
      source_file: 'PILS (niet op forecast)',
      list_kind: 'pils_only' as const,
      on_pils: true,
    }))

    const allLabelsForRequests = [
      ...all.map(row => String(row.case_label || '').trim()).filter(Boolean),
      ...pilsOnly.map(row => String(row.case_label || '').trim()).filter(Boolean),
    ]
    const customerRequestsByLabel = await loadCustomerRequestsByCaseLabel(allLabelsForRequests)

    pilsOnly = pilsOnly.map(row => attachCustomerRequests(row, customerRequestsByLabel, true))

    const forecastRows = all.map(row => {
      const label = String(row.case_label || '').trim()
      const onPils = label ? pilsLabels.has(label) : false
      return attachCustomerRequests(
        {
          ...row,
          list_kind: 'forecast' as const,
          on_pils: onPils,
        },
        customerRequestsByLabel,
        onPils
      )
    })

    return NextResponse.json(
      {
        data: forecastRows,
        pils_only: pilsOnly,
        count: forecastRows.length + pilsOnly.length,
        count_forecast_total: forecastRows.length,
        count_forecast_also_on_pils: excludedOnPils,
        count_pils_only: pilsOnly.length,
        count_in_database: all.length,
      },
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

