import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_backlog_history')
      .select('snapshot_date, backlog_overdue')
      .order('snapshot_date', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error('Error fetching backlog history:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching backlog history' },
      { status: 500 }
    )
  }
}
