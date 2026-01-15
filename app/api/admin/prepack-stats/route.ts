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

    // Get unique item numbers to fetch prices
    const uniqueItemNumbers = [...new Set(items.map((item: any) => item.item_number).filter(Boolean))]
    
    // Fetch latest prices for all items
    let pricesMap: Record<string, number> = {}
    if (uniqueItemNumbers.length > 0) {
      // Get the latest price for each item number
      const { data: salesOrders, error: salesError } = await supabaseAdmin
        .from('sales_orders')
        .select('item_number, price, uploaded_at')
        .in('item_number', uniqueItemNumbers)
        .order('uploaded_at', { ascending: false })

      if (!salesError && salesOrders) {
        // Use the latest price for each item
        salesOrders.forEach((order: any) => {
          if (!pricesMap[order.item_number]) {
            pricesMap[order.item_number] = parseFloat(order.price) || 0
          }
        })
      }
    }

    // Calculate statistics per day
    const dailyStats: Record<string, {
      date: string
      itemsPacked: number
      manHours: number
      employees: Set<string>
      revenue: number
    }> = {}

    // Process packed items
    items.forEach((item: any) => {
      const date = new Date(item.date_packed).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          itemsPacked: 0,
          manHours: 0,
          employees: new Set(),
          revenue: 0,
        }
      }
      const amount = item.amount || 0
      dailyStats[date].itemsPacked += amount
      
      // Calculate revenue for this item
      const price = pricesMap[item.item_number] || 0
      dailyStats[date].revenue += price * amount
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
        revenue: Number(stat.revenue.toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate totals
    const totalItemsPacked = items.reduce((sum, item: any) => sum + (item.amount || 0), 0)
    const totalManHours = logs.reduce((sum, log: any) => {
      if (log.start_time && log.end_time) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        return sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      }
      return sum
    }, 0)
    
    // Calculate total revenue
    const totalRevenue = items.reduce((sum, item: any) => {
      const price = pricesMap[item.item_number] || 0
      const amount = item.amount || 0
      return sum + (price * amount)
    }, 0)

    // Calculate statistics per person
    const personStatsMap: Record<string, {
      name: string
      itemsPacked: number
      manHours: number
    }> = {}

    // Distribute packed items proportionally based on time logs
    // For each day, calculate the proportion of work done by each person
    const dailyPersonWork: Record<string, Record<string, number>> = {}
    
    logs.forEach((log: any) => {
      if (log.start_time && log.end_time && log.employees?.name) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        const date = startTime.toISOString().split('T')[0]
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
        const personName = log.employees.name

        if (!dailyPersonWork[date]) {
          dailyPersonWork[date] = {}
        }
        if (!dailyPersonWork[date][personName]) {
          dailyPersonWork[date][personName] = 0
        }
        dailyPersonWork[date][personName] += hours

        // Initialize person stats
        if (!personStatsMap[personName]) {
          personStatsMap[personName] = {
            name: personName,
            itemsPacked: 0,
            manHours: 0,
          }
        }
        personStatsMap[personName].manHours += hours
      }
    })

    // Distribute packed items to persons based on their work proportion per day
    items.forEach((item) => {
      const date = new Date(item.date_packed).toISOString().split('T')[0]
      const dayWork = dailyPersonWork[date]
      if (dayWork) {
        const totalHoursForDay = Object.values(dayWork).reduce((sum, hours) => sum + hours, 0)
        if (totalHoursForDay > 0) {
          Object.entries(dayWork).forEach(([personName, hours]) => {
            if (!personStatsMap[personName]) {
              personStatsMap[personName] = {
                name: personName,
                itemsPacked: 0,
                manHours: 0,
              }
            }
            // Distribute items proportionally based on hours worked
            const proportion = hours / totalHoursForDay
            personStatsMap[personName].itemsPacked += Math.round((item.amount || 0) * proportion)
          })
        }
      }
    })

    // Convert person stats to array and calculate items per hour
    const personStatsArray = Object.values(personStatsMap)
      .map(stat => ({
        name: stat.name,
        itemsPacked: stat.itemsPacked,
        manHours: Number(stat.manHours.toFixed(2)),
        itemsPerHour: stat.manHours > 0 ? Number((stat.itemsPacked / stat.manHours).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.itemsPacked - a.itemsPacked) // Sort by items packed descending

    return NextResponse.json({
      dailyStats: dailyStatsArray,
      totals: {
        totalItemsPacked,
        totalManHours: Number(totalManHours.toFixed(2)),
        averageItemsPerHour: totalManHours > 0 ? Number((totalItemsPacked / totalManHours).toFixed(2)) : 0,
        totalDays: dailyStatsArray.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
      },
      personStats: personStatsArray,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




