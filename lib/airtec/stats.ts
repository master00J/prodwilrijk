import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

const parseFlexibleNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const normalizeKistnummer = (value: unknown) => {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

export interface DailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerFte: number
  revenue: number
  materialCost: number
  incomingItems: number
  fte: number
}

export interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalMaterialCost: number
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
  kistnummer: string | null
  item_number: string | null
  quantity: number
  price: number
  revenue: number
  materialCostUnit: number
  materialCostTotal: number
  date_packed: string
  date_received: string | null
}

export interface AirtecStatsResult {
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

const toDateKey = (value: unknown) => {
  const date = new Date(value as string)
  if (!Number.isFinite(date.getTime())) {
    return null
  }
  return date.toISOString().split('T')[0]
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

export async function fetchAirtecStats({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string
  dateTo?: string
}): Promise<AirtecStatsResult> {
  let packedQuery = supabaseAdmin.from('packed_items_airtec').select('*')

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
    .from('items_to_pack_airtec')
    .select('quantity, datum_ontvangen')

  if (dateFrom) {
    const fromDate = new Date(dateFrom)
    fromDate.setHours(0, 0, 0, 0)
    incomingQuery = incomingQuery.gte('datum_ontvangen', fromDate.toISOString())
  }

  if (dateTo) {
    const toDate = new Date(dateTo)
    toDate.setHours(23, 59, 59, 999)
    incomingQuery = incomingQuery.lte('datum_ontvangen', toDate.toISOString())
  }

  const { data: incomingItems, error: incomingError } = await incomingQuery

  if (incomingError) {
    throw new Error('Failed to fetch items to pack airtec')
  }

  let incomingPackedQuery = supabaseAdmin
    .from('packed_items_airtec')
    .select('quantity, datum_ontvangen, datum_opgestuurd')

  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(dateTo)
    toDate.setHours(23, 59, 59, 999)
    const fromIso = fromDate.toISOString()
    const toIso = toDate.toISOString()
    incomingPackedQuery = incomingPackedQuery.or(
      `and(datum_opgestuurd.gte.${fromIso},datum_opgestuurd.lte.${toIso}),and(datum_ontvangen.gte.${fromIso},datum_ontvangen.lte.${toIso})`
    )
  } else if (dateFrom) {
    const fromDate = new Date(dateFrom)
    fromDate.setHours(0, 0, 0, 0)
    const fromIso = fromDate.toISOString()
    incomingPackedQuery = incomingPackedQuery.or(
      `datum_opgestuurd.gte.${fromIso},datum_ontvangen.gte.${fromIso}`
    )
  } else if (dateTo) {
    const toDate = new Date(dateTo)
    toDate.setHours(23, 59, 59, 999)
    const toIso = toDate.toISOString()
    incomingPackedQuery = incomingPackedQuery.or(
      `datum_opgestuurd.lte.${toIso},datum_ontvangen.lte.${toIso}`
    )
  }

  const { data: incomingPackedItems, error: incomingPackedError } = await incomingPackedQuery

  if (incomingPackedError) {
    throw new Error('Failed to fetch packed items airtec incoming')
  }

  let timeLogsQuery = supabaseAdmin
    .from('time_logs')
    .select(
      `
        id,
        employee_id,
        start_time,
        end_time,
        type,
        employees(id, name)
      `
    )
    .eq('type', 'items_to_pack_airtec')
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
  const incoming = [...(incomingItems || []), ...(incomingPackedItems || [])]

  const uniqueKistnummers = [
    ...new Set(items.map((item: any) => normalizeKistnummer(item.kistnummer)).filter(Boolean)),
  ]
  let pricesMap: Record<string, number> = {}
  let costMap: Record<string, number> = {}

  if (uniqueKistnummers.length > 0) {
    const { data: prices } = await supabaseAdmin
      .from('airtec_prices')
      .select('kistnummer, price, assembly_cost, material_cost, transport_cost')
      .in('kistnummer', uniqueKistnummers)

    if (prices) {
      prices.forEach((price: any) => {
        const key = normalizeKistnummer(price?.kistnummer)
        if (key) {
          pricesMap[key] = parseFlexibleNumber(price.price)
          const assembly = parseFlexibleNumber(price.assembly_cost)
          const material = parseFlexibleNumber(price.material_cost)
          const transport = parseFlexibleNumber(price.transport_cost)
          costMap[key] = assembly + material + transport
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
      materialCost: number
      incomingItems: number
    }
  > = {}

  items.forEach((item: any) => {
    const date = toDateKey(item.date_packed) || toDateKey(item.datum_ontvangen)
    if (!date) return
    if (!dailyStats[date]) {
      dailyStats[date] = {
        date,
        itemsPacked: 0,
        manHours: 0,
        employees: new Set(),
        revenue: 0,
        materialCost: 0,
        incomingItems: 0,
      }
    }
    const quantity = item.quantity || 0
    dailyStats[date].itemsPacked += quantity

    const kistnummerKey = normalizeKistnummer(item.kistnummer)
    const price = kistnummerKey ? pricesMap[kistnummerKey] || 0 : 0
    dailyStats[date].revenue += price * quantity
    const costUnit = kistnummerKey ? costMap[kistnummerKey] || 0 : 0
    dailyStats[date].materialCost += costUnit * quantity
  })

  logs.forEach((log: any) => {
    if (log.start_time && log.end_time) {
      const startTime = new Date(log.start_time)
      const endTime = new Date(log.end_time)
      if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
        return
      }
      const date = startTime.toISOString().split('T')[0]

      const hours = calculateWorkedSeconds(startTime, endTime) / 3600

      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          itemsPacked: 0,
          manHours: 0,
          employees: new Set(),
          revenue: 0,
          materialCost: 0,
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
    const date = toDateKey(item.datum_opgestuurd) || toDateKey(item.datum_ontvangen)
    if (!date) return
    if (!dailyStats[date]) {
      dailyStats[date] = {
        date,
        itemsPacked: 0,
        manHours: 0,
        employees: new Set(),
        revenue: 0,
        materialCost: 0,
        incomingItems: 0,
      }
    }
    dailyStats[date].incomingItems += item.quantity || 0
  })

  const dailyStatsArray: DailyStat[] = Object.values(dailyStats)
    .map((stat) => {
      const expectedHours = getExpectedHoursForDay(stat.date)
      const fte =
        expectedHours > 0 ? Number((stat.manHours / expectedHours).toFixed(2)) : 0
      const itemsPerFte =
        fte > 0 ? Number((stat.itemsPacked / fte).toFixed(2)) : 0
      return {
        date: stat.date,
        itemsPacked: stat.itemsPacked,
        manHours: Number(stat.manHours.toFixed(2)),
        employeeCount: stat.employees.size,
        itemsPerFte,
        revenue: Number(stat.revenue.toFixed(2)),
        materialCost: Number(stat.materialCost.toFixed(2)),
        incomingItems: stat.incomingItems,
        fte,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalItemsPacked = items.reduce((sum, item: any) => sum + (item.quantity || 0), 0)
  const totalManHours = logs.reduce((sum, log: any) => {
    if (log.start_time && log.end_time) {
      const startTime = new Date(log.start_time)
      const endTime = new Date(log.end_time)
      return sum + calculateWorkedSeconds(startTime, endTime) / 3600
    }
    return sum
  }, 0)

  const totalRevenue = items.reduce((sum, item: any) => {
    const kistnummerKey = normalizeKistnummer(item.kistnummer)
    const price = kistnummerKey ? pricesMap[kistnummerKey] || 0 : 0
    const quantity = item.quantity || 0
    return sum + price * quantity
  }, 0)

  const totalIncoming = incoming.reduce((sum, item: any) => sum + (item.quantity || 0), 0)
  const incomingVsPackedRatio =
    totalItemsPacked > 0 ? Number((totalIncoming / totalItemsPacked).toFixed(2)) : null

  const leadTimes = items
    .map((item: any) => {
      if (!item.datum_ontvangen || !item.date_packed) return null
      const received = new Date(item.datum_ontvangen)
      const packed = new Date(item.date_packed)
      if (!Number.isFinite(received.getTime()) || !Number.isFinite(packed.getTime()) || packed <= received) {
        return null
      }
      const businessDays = calculateBusinessDays(received, packed)
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
  const averageItemsPerFte = totalFte > 0 ? Number((totalItemsPacked / totalFte).toFixed(2)) : 0

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
      const kistnummerKey = normalizeKistnummer(item.kistnummer)
      const price = kistnummerKey ? pricesMap[kistnummerKey] || 0 : 0
      const costUnit = kistnummerKey ? costMap[kistnummerKey] || 0 : 0
      const quantity = item.quantity || 0
      const revenue = price * quantity
      const costTotal = costUnit * quantity

      return {
        id: item.id,
        kistnummer: item.kistnummer || null,
        item_number: item.item_number || null,
        quantity,
        price: Number(price.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        materialCostUnit: Number(costUnit.toFixed(2)),
        materialCostTotal: Number(costTotal.toFixed(2)),
        date_packed: item.date_packed,
        date_received: item.datum_ontvangen || null,
      }
    })
    .sort((a, b) => {
      const left = new Date(b.date_packed).getTime()
      const right = new Date(a.date_packed).getTime()
      const safeLeft = Number.isFinite(left) ? left : 0
      const safeRight = Number.isFinite(right) ? right : 0
      return safeLeft - safeRight
    })

  const totalMaterialCost = detailedItems.reduce((sum, item) => sum + item.materialCostTotal, 0)

  return {
    dailyStats: dailyStatsArray,
    totals: {
      totalItemsPacked,
      totalManHours: Number(totalManHours.toFixed(2)),
      averageItemsPerFte,
      totalDays: totalDaysPacked,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalMaterialCost: Number(totalMaterialCost.toFixed(2)),
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
