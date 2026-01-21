import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

export interface DailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerHour: number
  revenue: number
  incomingItems: number
  fte: number
}

export interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerHour: number
  totalDays: number
  totalRevenue: number
  totalIncoming: number
  incomingVsPackedRatio: number | null
  avgLeadTimeHours: number | null
  totalFte: number
  avgFtePerDay: number
}

export interface PersonStats {
  name: string
  manHours: number
}

export interface DetailedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  price: number
  revenue: number
  date_packed: string
  date_added: string
}

export interface PrepackStatsResult {
  dailyStats: DailyStat[]
  totals: Totals
  personStats: PersonStats[]
  detailedItems: DetailedItem[]
}

const isWeekday = (date: Date) => {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

const toStartOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const calculateBusinessDays = (start: Date, end: Date) => {
  if (end <= start) return 0
  const startDay = toStartOfDay(start)
  const endDay = toStartOfDay(end)
  let cursor = new Date(startDay)
  let totalDays = 0

  while (cursor < endDay) {
    cursor.setDate(cursor.getDate() + 1)
    if (isWeekday(cursor)) {
      totalDays += 1
    }
  }

  return totalDays
}

const getExpectedHoursForDay = (dateValue: string) => {
  const date = new Date(dateValue)
  const day = date.getDay()
  if (day === 5) return 7
  if (day === 0 || day === 6) return 0
  return 8
}

export async function fetchPrepackStats({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string
  dateTo?: string
}): Promise<PrepackStatsResult> {
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
    throw new Error('Failed to fetch packed items')
  }

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
    throw new Error('Failed to fetch incoming goods')
  }

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
    .not('end_time', 'is', null)

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
    throw new Error('Failed to fetch time logs')
  }

  const items = packedItems || []
  const logs = timeLogs || []
  const incoming = incomingItems || []

  const uniqueItemNumbers = [
    ...new Set(items.map((item: any) => item.item_number).filter(Boolean)),
  ]

  let pricesMap: Record<string, number> = {}
  if (uniqueItemNumbers.length > 0) {
    const { data: salesOrders } = await supabaseAdmin
      .from('sales_orders')
      .select('item_number, price, uploaded_at')
      .in('item_number', uniqueItemNumbers)
      .order('uploaded_at', { ascending: false })

    if (salesOrders) {
      salesOrders.forEach((order: any) => {
        if (!pricesMap[order.item_number]) {
          pricesMap[order.item_number] = parseFloat(order.price) || 0
        }
      })
    }
  }

  const dailyStats: Record<
    string,
    {
      date: string
      itemsPacked: number
      manHours: number
      employees: Set<string>
      revenue: number
      incomingItems: number
    }
  > = {}

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

    const price = pricesMap[item.item_number] || 0
    dailyStats[date].revenue += price * amount
  })

  logs.forEach((log: any) => {
    if (log.start_time && log.end_time) {
      const startTime = new Date(log.start_time)
      const endTime = new Date(log.end_time)
      const date = startTime.toISOString().split('T')[0]

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

  const dailyStatsArray: DailyStat[] = Object.values(dailyStats)
    .map((stat) => {
      const expectedHours = getExpectedHoursForDay(stat.date)
      const fte =
        expectedHours > 0 ? Number((stat.manHours / expectedHours).toFixed(2)) : 0
      return {
        date: stat.date,
        itemsPacked: stat.itemsPacked,
        manHours: Number(stat.manHours.toFixed(2)),
        employeeCount: stat.employees.size,
        itemsPerHour: stat.manHours > 0
          ? Number((stat.itemsPacked / stat.manHours).toFixed(2))
          : 0,
        revenue: Number(stat.revenue.toFixed(2)),
        incomingItems: stat.incomingItems,
        fte,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalItemsPacked = items.reduce((sum, item: any) => sum + (item.amount || 0), 0)
  const totalManHours = logs.reduce((sum, log: any) => {
    if (log.start_time && log.end_time) {
      const startTime = new Date(log.start_time)
      const endTime = new Date(log.end_time)
      return sum + calculateWorkedSeconds(startTime, endTime) / 3600
    }
    return sum
  }, 0)

  const totalRevenue = items.reduce((sum, item: any) => {
    const price = pricesMap[item.item_number] || 0
    const amount = item.amount || 0
    return sum + price * amount
  }, 0)

  const totalIncoming = incoming.reduce((sum, item: any) => sum + (item.amount || 0), 0)
  const incomingVsPackedRatio =
    totalItemsPacked > 0 ? Number((totalIncoming / totalItemsPacked).toFixed(2)) : null

  const filterStart = dateFrom ? toStartOfDay(new Date(dateFrom)) : null
  const leadTimes = items
    .map((item: any) => {
      if (!item.date_added || !item.date_packed) return null
      const added = new Date(item.date_added)
      const packed = new Date(item.date_packed)
      if (!Number.isFinite(added.getTime()) || !Number.isFinite(packed.getTime()) || packed <= added) {
        return null
      }
      const effectiveStart =
        filterStart && filterStart.getTime() > added.getTime() ? filterStart : added
      const businessDays = calculateBusinessDays(effectiveStart, packed)
      return businessDays * 24
    })
    .filter((value: number | null): value is number => value !== null)

  const avgLeadTimeHours =
    leadTimes.length > 0
      ? Number((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length).toFixed(2))
      : null

  const totalDaysPacked =
    dailyStatsArray.filter((stat) => stat.itemsPacked > 0 || stat.manHours > 0).length ||
    dailyStatsArray.length

  const totalFte = dailyStatsArray.reduce((sum, stat) => sum + stat.fte, 0)
  const avgFtePerDay = totalDaysPacked > 0 ? Number((totalFte / totalDaysPacked).toFixed(2)) : 0

  const personStatsMap: Record<string, { name: string; manHours: number }> = {}
  logs.forEach((log: any) => {
    if (log.start_time && log.end_time && log.employees?.name) {
      const startTime = new Date(log.start_time)
      const endTime = new Date(log.end_time)
      const hours = calculateWorkedSeconds(startTime, endTime) / 3600
      const personName = log.employees.name

      if (!personStatsMap[personName]) {
        personStatsMap[personName] = {
          name: personName,
          manHours: 0,
        }
      }
      personStatsMap[personName].manHours += hours
    }
  })

  const personStatsArray = Object.values(personStatsMap)
    .map((stat) => ({
      name: stat.name,
      manHours: Number(stat.manHours.toFixed(2)),
    }))
    .sort((a, b) => b.manHours - a.manHours)

  const detailedItems: DetailedItem[] = items
    .map((item: any) => {
      const price = pricesMap[item.item_number] || 0
      const amount = item.amount || 0
      const revenue = price * amount

      return {
        id: item.id,
        item_number: item.item_number,
        po_number: item.po_number,
        amount,
        price: Number(price.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        date_packed: item.date_packed,
        date_added: item.date_added,
      }
    })
    .sort((a, b) => new Date(b.date_packed).getTime() - new Date(a.date_packed).getTime())

  return {
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
      totalFte: Number(totalFte.toFixed(2)),
      avgFtePerDay,
    },
    personStats: personStatsArray,
    detailedItems,
  }
}
