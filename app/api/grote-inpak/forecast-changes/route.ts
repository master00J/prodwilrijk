import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const caseLabel   = searchParams.get('case_label')
    const dateFrom    = searchParams.get('date_from')
    const dateTo      = searchParams.get('date_to')
    const snapshotId  = searchParams.get('snapshot_id')
    const changeType  = searchParams.get('change_type')

    const pageSize = 1000
    let from = 0
    const all: any[] = []

    while (true) {
      let query = supabaseAdmin
        .from('grote_inpak_forecast_changes')
        .select('*')
        .order('changed_at', { ascending: false })
        .order('case_label', { ascending: true })

      if (caseLabel) query = query.eq('case_label', caseLabel)
      if (snapshotId) query = query.eq('snapshot_id', snapshotId)
      if (changeType) query = query.eq('change_type', changeType)
      if (dateFrom) query = query.gte('changed_at', dateFrom)
      if (dateTo) query = query.lte('changed_at', dateTo)

      const { data, error } = await query.range(from, from + pageSize - 1)
      if (error) throw error
      const rows = data || []
      if (rows.length === 0) break
      all.push(...rows)
      from += rows.length
    }

    return NextResponse.json({ data: all, count: all.length })
  } catch (error: any) {
    console.error('Error fetching forecast changes:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching forecast changes' },
      { status: 500 }
    )
  }
}
