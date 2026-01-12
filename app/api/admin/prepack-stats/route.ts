import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    // Get packed items
    let packedQuery = supabaseAdmin.from('packed_items').select('*')
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      packedQuery = packedQuery.gte('date_packed', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      packedQuery = packedQuery.lte('date_packed', toDate.toISOString())
    }

    const { data: packedItems, error: packedError } = await packedQuery

    if (packedError) {
      console.error('Error fetching packed items:', packedError)
      return NextResponse.json(
        { error: 'Failed to fetch packed items' },
        { status: 500 }
      )
    }

    // Get time logs for items_to_pack type
    let timeLogsQuery = supabaseAdmin
      .from('time_logs')
      .select(`
        id,
        employee_id,
        start_time,
        end_time,
        type,
        employees(id, name)
      `)
      .eq('type', 'items_to_pack')
      .not('end_time', 'is', null) // Only completed logs

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      timeLogsQuery = timeLogsQuery.gte('start_time', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      timeLogsQuery = timeLogsQuery.lte('start_time', toDate.toISOString())
    }

    const { data: timeLogs, error: timeLogsError } = await timeLogsQuery

    if (timeLogsError) {
      console.error('Error fetching time logs:', timeLogsError)
      return NextResponse.json(
        { error: 'Failed to fetch time logs' },
        { status: 500 }
      )
    }

    const items = packedItems || []
    const logs = timeLogs || []

    // Calculate statistics per day
    const dailyStats: Record<string, {
      date: string
      itemsPacked: number
      manHours: number
      employees: Set<string>
    }> = {}

    // Process packed items
    items.forEach((item) => {
      const date = new Date(item.date_packed).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          itemsPacked: 0,
          manHours: 0,
          employees: new Set(),
        }
      }
      dailyStats[date].itemsPacked += item.amount || 0
    })

    // Process time logs
    logs.forEach((log: any) => {
      if (log.start_time && log.end_time) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        const date = startTime.toISOString().split('T')[0]
        
        // Calculate hours worked
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
        
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            itemsPacked: 0,
            manHours: 0,
            employees: new Set(),
          }
        }
        
        dailyStats[date].manHours += hours
        if (log.employees?.name) {
          dailyStats[date].employees.add(log.employees.name)
        }
      }
    })

    // Convert to array and sort by date
    const dailyStatsArray = Object.values(dailyStats)
      .map(stat => ({
        date: stat.date,
        itemsPacked: stat.itemsPacked,
        manHours: Number(stat.manHours.toFixed(2)),
        employeeCount: stat.employees.size,
        itemsPerHour: stat.manHours > 0 ? Number((stat.itemsPacked / stat.manHours).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate totals
    const totalItemsPacked = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const totalManHours = logs.reduce((sum, log: any) => {
      if (log.start_time && log.end_time) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        return sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      }
      return sum
    }, 0)

    return NextResponse.json({
      dailyStats: dailyStatsArray,
      totals: {
        totalItemsPacked,
        totalManHours: Number(totalManHours.toFixed(2)),
        averageItemsPerHour: totalManHours > 0 ? Number((totalItemsPacked / totalManHours).toFixed(2)) : 0,
        totalDays: dailyStatsArray.length,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



