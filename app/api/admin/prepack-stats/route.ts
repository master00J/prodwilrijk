import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

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

    // Get incoming goods (items_to_pack)
    let incomingQuery = supabaseAdmin
      .from('items_to_pack')
      .select('amount, date_added')

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      incomingQuery = incomingQuery.gte('date_added', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      incomingQuery = incomingQuery.lte('date_added', toDate.toISOString())
    }

    const { data: incomingItems, error: incomingError } = await incomingQuery

    if (incomingError) {
      console.error('Error fetching incoming goods:', incomingError)
      return NextResponse.json(
        { error: 'Failed to fetch incoming goods' },
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
    const incoming = incomingItems || []

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
      incomingItems: number
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
          incomingItems: 0,
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
        
        // Calculate hours worked (exclude lunch break)
        const hours = calculateWorkedSeconds(startTime, endTime) / 3600
        
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            itemsPacked: 0,
            manHours: 0,
            employees: new Set(),
            revenue: 0,
            incomingItems: 0,
          }
        }
        
        dailyStats[date].manHours += hours
        if (log.employees?.name) {
          dailyStats[date].employees.add(log.employees.name)
        }
      }
    })

    // Process incoming goods
    incoming.forEach((item: any) => {
      const date = new Date(item.date_added).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          itemsPacked: 0,
          manHours: 0,
          employees: new Set(),
          revenue: 0,
          incomingItems: 0,
        }
      }
      const amount = item.amount || 0
      dailyStats[date].incomingItems += amount
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
        incomingItems: stat.incomingItems,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate totals
    const totalItemsPacked = items.reduce((sum, item: any) => sum + (item.amount || 0), 0)
    const totalManHours = logs.reduce((sum, log: any) => {
      if (log.start_time && log.end_time) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        return sum + calculateWorkedSeconds(startTime, endTime) / 3600
      }
      return sum
    }, 0)
    
    // Calculate total revenue
    const totalRevenue = items.reduce((sum, item: any) => {
      const price = pricesMap[item.item_number] || 0
      const amount = item.amount || 0
      return sum + (price * amount)
    }, 0)

    const totalIncoming = incoming.reduce((sum, item: any) => sum + (item.amount || 0), 0)
    const incomingVsPackedRatio =
      totalItemsPacked > 0 ? Number((totalIncoming / totalItemsPacked).toFixed(2)) : null

    const leadTimes = items
      .map((item: any) => {
        if (!item.date_added || !item.date_packed) return null
        const added = new Date(item.date_added).getTime()
        const packed = new Date(item.date_packed).getTime()
        if (!Number.isFinite(added) || !Number.isFinite(packed) || packed <= added) return null
        return (packed - added) / 3600000
      })
      .filter((value: number | null): value is number => value !== null)

    const avgLeadTimeHours =
      leadTimes.length > 0
        ? Number((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length).toFixed(2))
        : null

    const totalDaysPacked =
      dailyStatsArray.filter((stat) => stat.itemsPacked > 0 || stat.manHours > 0).length ||
      dailyStatsArray.length

    // Calculate statistics per person (only track who worked and their hours)
    const personStatsMap: Record<string, {
      name: string
      manHours: number
    }> = {}
    
    logs.forEach((log: any) => {
      if (log.start_time && log.end_time && log.employees?.name) {
        const startTime = new Date(log.start_time)
        const endTime = new Date(log.end_time)
        const hours = calculateWorkedSeconds(startTime, endTime) / 3600
        const personName = log.employees.name

        // Initialize person stats
        if (!personStatsMap[personName]) {
          personStatsMap[personName] = {
            name: personName,
            manHours: 0,
          }
        }
        personStatsMap[personName].manHours += hours
      }
    })

    // Convert person stats to array (sorted by manHours descending)
    const personStatsArray = Object.values(personStatsMap)
      .map(stat => ({
        name: stat.name,
        manHours: Number(stat.manHours.toFixed(2)),
      }))
      .sort((a, b) => b.manHours - a.manHours) // Sort by manHours descending

    // Prepare detailed items list with prices
    const detailedItems = items.map((item: any) => {
      const price = pricesMap[item.item_number] || 0
      const amount = item.amount || 0
      const revenue = price * amount
      
      return {
        id: item.id,
        item_number: item.item_number,
        po_number: item.po_number,
        amount: amount,
        price: Number(price.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        date_packed: item.date_packed,
        date_added: item.date_added,
      }
    }).sort((a, b) => {
      // Sort by date_packed descending (newest first)
      return new Date(b.date_packed).getTime() - new Date(a.date_packed).getTime()
    })

    return NextResponse.json({
      dailyStats: dailyStatsArray,
      totals: {
        totalItemsPacked,
        totalManHours: Number(totalManHours.toFixed(2)),
        averageItemsPerHour: totalManHours > 0 ? Number((totalItemsPacked / totalManHours).toFixed(2)) : 0,
        totalDays: totalDaysPacked,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalIncoming,
        incomingVsPackedRatio,
        avgLeadTimeHours,
      },
      personStats: personStatsArray,
      detailedItems: detailedItems,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




