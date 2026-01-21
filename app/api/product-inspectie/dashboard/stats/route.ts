import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [todayResult, statusResult, weekResult, topUsersResult] = await Promise.all([
      supabaseAdmin
        .from('product_controles')
        .select('id', { count: 'exact', head: true })
        .gte('controle_datum', `${todayStr}T00:00:00.000Z`)
        .lte('controle_datum', `${todayStr}T23:59:59.999Z`),
      supabaseAdmin
        .from('product_controles')
        .select('status'),
      supabaseAdmin
        .from('product_controles')
        .select('id', { count: 'exact', head: true })
        .gte('controle_datum', `${weekAgo}T00:00:00.000Z`),
      supabaseAdmin
        .from('product_controles')
        .select('uitgevoerd_door')
        .gte('controle_datum', `${weekAgo}T00:00:00.000Z`),
    ])

    const statusBreakdown: Record<string, number> = {}
    statusResult.data?.forEach((row: any) => {
      const status = row.status || 'onbekend'
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1
    })

    const topUsersMap: Record<string, number> = {}
    topUsersResult.data?.forEach((row: any) => {
      const name = row.uitgevoerd_door || 'Onbekend'
      topUsersMap[name] = (topUsersMap[name] || 0) + 1
    })

    const topUsers = Object.entries(topUsersMap)
      .map(([uitgevoerd_door, controle_count]) => ({ uitgevoerd_door, controle_count }))
      .sort((a, b) => b.controle_count - a.controle_count)
      .slice(0, 5)

    return NextResponse.json({
      today: todayResult.count || 0,
      thisWeek: weekResult.count || 0,
      statusBreakdown,
      topUsers,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
