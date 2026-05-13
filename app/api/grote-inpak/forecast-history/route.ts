import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const caseType = searchParams.get('case_type') || ''
    const onlyChanged = searchParams.get('only_changed') === '1'

    const pageSize = 1000

    const changes: any[] = []
    {
      let from = 0
      while (true) {
        const { data: chunk, error: changesError } = await supabaseAdmin
          .from('grote_inpak_forecast_changes')
          .select('case_label, case_type, old_arrival_date, new_arrival_date, change_type, changed_at')
          .order('case_label', { ascending: true })
          .order('changed_at', { ascending: true })
          .range(from, from + pageSize - 1)

        if (changesError) throw changesError
        const rows = chunk || []
        if (rows.length === 0) break
        changes.push(...rows)
        from += rows.length
      }
    }

    const current: any[] = []
    {
      let from = 0
      while (true) {
        const { data: chunk, error: currentError } = await supabaseAdmin
          .from('grote_inpak_forecast')
          .select('case_label, case_type, arrival_date')
          .order('case_label', { ascending: true })
          .range(from, from + pageSize - 1)

        if (currentError) throw currentError
        const rows = chunk || []
        if (rows.length === 0) break
        current.push(...rows)
        from += rows.length
      }
    }

    const currentMap = new Map<string, { case_type: string; arrival_date: string }>()
    ;(current || []).forEach((row: any) => {
      if (row.case_label) currentMap.set(row.case_label, row)
    })

    // Groepeer wijzigingen per caselabel
    const historyMap = new Map<string, {
      case_label: string
      case_type: string
      dates: string[]        // alle datums in chronologische volgorde (uniek)
      current_date: string | null
      date_count: number     // aantal keer datum gewijzigd
      shift_days: number | null  // totale verschuiving t.o.v. eerste datum
    }>()

    ;(changes || []).forEach((row: any) => {
      const label = row.case_label
      if (!label) return

      if (!historyMap.has(label)) {
        historyMap.set(label, {
          case_label: label,
          case_type: row.case_type || '',
          dates: [],
          current_date: currentMap.get(label)?.arrival_date ?? null,
          date_count: 0,
          shift_days: null,
        })
      }

      const entry = historyMap.get(label)!

      if (row.change_type === 'added' && row.new_arrival_date) {
        if (!entry.dates.includes(row.new_arrival_date)) {
          entry.dates.push(row.new_arrival_date)
        }
      } else if (row.change_type === 'date_change') {
        if (row.old_arrival_date && !entry.dates.includes(row.old_arrival_date)) {
          entry.dates.push(row.old_arrival_date)
        }
        if (row.new_arrival_date && !entry.dates.includes(row.new_arrival_date)) {
          entry.dates.push(row.new_arrival_date)
          entry.date_count++
        }
      }

      if (row.case_type && !entry.case_type) entry.case_type = row.case_type
    })

    // Voeg ook caselabels toe die al in huidige forecast zitten maar nog geen historiek hebben
    ;(current || []).forEach((row: any) => {
      if (!row.case_label) return
      if (!historyMap.has(row.case_label)) {
        historyMap.set(row.case_label, {
          case_label: row.case_label,
          case_type: row.case_type || '',
          dates: [],
          current_date: row.arrival_date,
          date_count: 0,
          shift_days: null,
        })
      }
    })

    // Bereken totale verschuiving: eerste datum vs huidige datum
    historyMap.forEach((entry) => {
      const allDates = [...entry.dates]
      if (entry.current_date && !allDates.includes(entry.current_date)) {
        allDates.push(entry.current_date)
      }
      allDates.sort()

      if (allDates.length >= 2) {
        const first = new Date(allDates[0]).getTime()
        const last = new Date(allDates[allDates.length - 1]).getTime()
        entry.shift_days = Math.round((last - first) / 86400000)
      }

      // Sorteer datums chronologisch
      entry.dates.sort()
    })

    let result = Array.from(historyMap.values())

    // Filter: alleen gewijzigde
    if (onlyChanged) {
      result = result.filter(r => r.date_count > 0)
    }

    // Filter: zoekterm
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.case_label.toLowerCase().includes(q) ||
        r.case_type.toLowerCase().includes(q)
      )
    }

    // Filter: kisttype (V = vaszak-variant van K, tel mee bij K-filter)
    if (caseType) {
      const ct = caseType.toUpperCase()
      result = result.filter(r => {
        const t = (r.case_type || '').toUpperCase()
        if (ct === 'K') return t.startsWith('K') || t.startsWith('V')
        return t.startsWith(ct)
      })
    }

    // Sortering: meest gewijzigd bovenaan, dan op caselabel
    result.sort((a, b) => {
      if (b.date_count !== a.date_count) return b.date_count - a.date_count
      return a.case_label.localeCompare(b.case_label)
    })

    return NextResponse.json({ data: result, count: result.length })
  } catch (error: any) {
    console.error('Error fetching forecast history:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching forecast history' },
      { status: 500 }
    )
  }
}
