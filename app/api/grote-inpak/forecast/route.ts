import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

    // Dedupliceer op case_label — bij conflict: kies de recentste (grootste) aankomstdatum
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

    // Haal de huidige forecast op vóór vervanging voor change tracking
    let currentForecast: any[] = []
    if (replace) {
      const { data: currentData, error: currentError } = await supabaseAdmin
        .from('grote_inpak_forecast')
        .select('case_label, case_type, arrival_date, source_file')

      if (currentError) throw currentError
      currentForecast = currentData || []

      const { error: deleteError } = await supabaseAdmin
        .from('grote_inpak_forecast')
        .delete()
        .not('id', 'is', null)

      if (deleteError) throw deleteError
    }

    const { data, error } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .upsert(deduped, { onConflict: 'case_label', ignoreDuplicates: false })
      .select()

    if (error) throw error

    // ── Change tracking met snapshot ──────────────────────────────────────
    if (replace) {
      const snapshotId = crypto.randomUUID()
      const changes: any[] = []

      const currentMap = new Map<string, any>()
      currentForecast.forEach((row) => {
        const label = String(row.case_label || '').trim()
        if (!label) return
        currentMap.set(label, row)
      })

      const newLabels = new Set<string>()
      deduped.forEach((row: any) => {
        const label = String(row.case_label || '').trim()
        if (!label) return
        newLabels.add(label)

        const prev = currentMap.get(label)
        if (!prev) {
          // Nieuw toegevoegd aan de forecast
          changes.push({
            case_label: label,
            case_type: row.case_type || null,
            old_arrival_date: null,
            new_arrival_date: String(row.arrival_date || '').trim() || null,
            source_file: row.source_file || null,
            change_type: 'added',
            snapshot_id: snapshotId,
          })
        } else {
          // Bestaand label → check datumwijziging
          const oldDate = String(prev.arrival_date || '').trim()
          const newDate = String(row.arrival_date || '').trim()
          if (oldDate && newDate && oldDate !== newDate) {
            changes.push({
              case_label: label,
              case_type: row.case_type || prev.case_type || null,
              old_arrival_date: oldDate,
              new_arrival_date: newDate,
              source_file: row.source_file || prev.source_file || null,
              change_type: 'date_change',
              snapshot_id: snapshotId,
            })
          }
        }
      })

      // Verwijderde labels (stonden in vorige forecast maar niet meer in nieuwe)
      currentMap.forEach((row, label) => {
        if (!newLabels.has(label)) {
          changes.push({
            case_label: label,
            case_type: row.case_type || null,
            old_arrival_date: String(row.arrival_date || '').trim() || null,
            new_arrival_date: null,
            source_file: row.source_file || null,
            change_type: 'removed',
            snapshot_id: snapshotId,
          })
        }
      })

      const cntAdded      = changes.filter(c => c.change_type === 'added').length
      const cntRemoved    = changes.filter(c => c.change_type === 'removed').length
      const cntDateChange = changes.filter(c => c.change_type === 'date_change').length

      // Sla snapshot op (altijd, ook als er geen wijzigingen zijn)
      await supabaseAdmin.from('grote_inpak_forecast_snapshots').insert({
        id: snapshotId,
        source_files: [...new Set(deduped.map((r: any) => r.source_file).filter(Boolean))],
        total_records: deduped.length,
        cnt_added: cntAdded,
        cnt_removed: cntRemoved,
        cnt_date_change: cntDateChange,
      })

      if (changes.length > 0) {
        const { error: changeError } = await supabaseAdmin
          .from('grote_inpak_forecast_changes')
          .insert(changes)
        if (changeError) throw changeError
      }

      return NextResponse.json({
        success: true, data, count: data?.length || 0,
        snapshot_id: snapshotId,
        changes: { added: cntAdded, removed: cntRemoved, date_change: cntDateChange },
      })
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

