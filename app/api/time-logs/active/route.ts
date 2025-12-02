import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('time_logs')
      .select(`
        id,
        employee_id,
        start_time,
        end_time,
        employees!inner(id, name)
      `)
      .is('end_time', null)
      .eq('type', 'items_to_pack')
      .order('start_time', { ascending: false })

    if (error) {
      console.error('Error fetching active time logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch active time logs' },
        { status: 500 }
      )
    }

    // Transform data to include employee name and calculate elapsed time
    const now = new Date()
    const transformed = (data || []).map((log: any) => {
      const start = new Date(log.start_time)
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
      return {
        id: log.id,
        employee_id: log.employee_id,
        employee_name: log.employees?.name || 'Unknown',
        start_time: log.start_time,
        elapsed_seconds: elapsed,
      }
    })

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

