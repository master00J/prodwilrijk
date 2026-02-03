import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

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
  item_number: string
  po_number: string
  amount: number
  price: number
  revenue: number
  materialCostUnit: number
  materialCostTotal: number
  date_packed: string
  date_added: string
}

export interface PrepackStatsResult {
  dailyStats: DailyStat[]
  totals: Totals
  personStats: PersonStats[]
  detailedItems: DetailedItem[]
  detailsLimited?: boolean
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

const toDateKey = (value: unknown) => {
  const date = new Date(value as string)
  if (!Number.isFinite(date.getTime())) {
    return null
  }
  return date.toISOString().split('T')[0]
}

const normalizeItemNumber = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim().toUpperCase()
}

const fetchAllRows = async <T,>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
) => {
  const pageSize = 1000
  let from = 0
  const allRows: T[] = []

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) {
      throw error
    }
    const rows = (data || []) as T[]
    allRows.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }

  return allRows
}

const getMaterialCostForComponent = (component: any, price: number, unitOfMeasure: string) => {
  const unitCount = Number(component.component_unit) || 0
  if (unitOfMeasure === 'm3') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const thickness = Number(component.component_thickness) || 0
    const volume = (length * width * thickness) / 1_000_000_000
    return volume * unitCount * price
  }
  if (unitOfMeasure === 'm2') {
    const length = Number(component.component_length) || 0
    const width = Number(component.component_width) || 0
    const area = (length * width) / 1_000_000
    return area * unitCount * price
  }
  return unitCount * price
}

export async function fetchPrepackStats({
  dateFrom,
  dateTo,
  includeDetails = true,
}: {
  dateFrom?: string
  dateTo?: string
  includeDetails?: boolean
}): Promise<PrepackStatsResult> {
  const maxDetailsDays = 120
  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
  const toDate = dateTo ? new Date(`${dateTo}T00:00:00`) : null
  const rangeDays =
    fromDate && toDate && Number.isFinite(fromDate.getTime()) && Number.isFinite(toDate.getTime())
      ? Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000)
      : 0
  const skipDetails = !includeDetails || (rangeDays > maxDetailsDays && includeDetails)
  const fromValue = dateFrom ? `${dateFrom} 00:00:00` : null
  const toValue = dateTo ? `${dateTo} 23:59:59` : null

  const packedItems = await fetchAllRows<any>(async (from, to) => {
    let query = supabaseAdmin.from('packed_items').select('*').range(from, to)
    if (fromValue) {
      query = query.gte('date_packed', fromValue)
    }
    if (toValue) {
      query = query.lte('date_packed', toValue)
    }
    return await query
  })

  const incomingItems = await fetchAllRows<any>(async (from, to) => {
    let query = supabaseAdmin
      .from('items_to_pack')
      .select('amount, date_added')
      .range(from, to)
    if (fromValue) {
      query = query.gte('date_added', fromValue)
    }
    if (toValue) {
      query = query.lte('date_added', toValue)
    }
    return await query
  })

  const incomingPackedItems = await fetchAllRows<any>(async (from, to) => {
    let query = supabaseAdmin
      .from('packed_items')
      .select('amount, date_added, date_packed')
      .range(from, to)
    if (fromValue) {
      query = query.gte('date_added', fromValue)
    }
    if (toValue) {
      query = query.lte('date_added', toValue)
    }
    return await query
  })

  const timeLogs = await fetchAllRows<any>(async (from, to) => {
    let query = supabaseAdmin
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
      .eq('type', 'items_to_pack')
      .not('end_time', 'is', null)
      .range(from, to)
    if (fromValue) {
      query = query.gte('start_time', fromValue)
    }
    if (toValue) {
      query = query.lte('start_time', toValue)
    }
    return await query
  })

  const items = packedItems || []
  const logs = timeLogs || []
  const incoming = [...(incomingItems || []), ...(incomingPackedItems || [])]

  const rawItemNumbers = items
    .map((item: any) => item.item_number)
    .filter(Boolean)
    .map((value: any) => String(value))
  const normalizedItemNumbers = rawItemNumbers.map((value) => normalizeItemNumber(value)).filter(Boolean)
  const uniqueItemNumbers = Array.from(new Set([...rawItemNumbers, ...normalizedItemNumbers]))

  let pricesMap: Record<string, number> = {}
  if (uniqueItemNumbers.length > 0) {
    const { data: salesOrders } = await supabaseAdmin
      .from('sales_orders')
      .select('item_number, price, uploaded_at')
      .in('item_number', uniqueItemNumbers)
      .order('uploaded_at', { ascending: false })

    if (salesOrders) {
      salesOrders.forEach((order: any) => {
        const key = normalizeItemNumber(order.item_number)
        if (!key) return
        if (!pricesMap[key]) {
          pricesMap[key] = parseFloat(order.price) || 0
        }
      })
    }
  }

  let materialCostMap: Record<string, number> = {}
  if (uniqueItemNumbers.length > 0) {
    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select(
        `
          id,
          item_number,
          production_order_id,
          production_orders (uploaded_at),
          production_order_components (
            component_item_no,
            component_unit,
            component_length,
            component_width,
            component_thickness
          )
        `
      )
      .in('item_number', uniqueItemNumbers)

    if (!linesError && lines) {
        const componentItemNumbers = new Set<string>()
      lines.forEach((line: any) => {
        const components = line.production_order_components || []
        components.forEach((component: any) => {
          if (component.component_item_no) {
              componentItemNumbers.add(String(component.component_item_no))
              const normalized = normalizeItemNumber(component.component_item_no)
              if (normalized) {
                componentItemNumbers.add(normalized)
              }
          }
        })
      })

      let materialPriceMap: Record<string, number> = {}
      let materialUnitMap: Record<string, string> = {}
      if (componentItemNumbers.size > 0) {
        const { data: materialPrices } = await supabaseAdmin
          .from('material_prices')
          .select('item_number, price, unit_of_measure')
          .in('item_number', Array.from(componentItemNumbers))

        if (materialPrices) {
          materialPrices.forEach((item: any) => {
            const key = normalizeItemNumber(item.item_number)
            if (!key) return
            materialPriceMap[key] = Number(item.price) || 0
            if (item.unit_of_measure) {
              materialUnitMap[key] = String(item.unit_of_measure).trim()
            }
          })
        }
      }

      const latestCosts: Record<string, { cost: number; uploadedAt: string }> = {}
      lines.forEach((line: any) => {
        if (!line.item_number) return
        const normalizedLineNumber = normalizeItemNumber(line.item_number)
        if (!normalizedLineNumber) return
        const uploadedAt =
          line.production_orders?.uploaded_at ||
          line.production_orders?.[0]?.uploaded_at ||
          ''
        if (!uploadedAt) return

        const components = line.production_order_components || []
        let costPerItem = 0
        let hasAnyCost = false
        components.forEach((component: any) => {
          const componentItemNo = component.component_item_no
          if (!componentItemNo) return
          const componentKey = normalizeItemNumber(componentItemNo)
          if (!componentKey) return
          const price = materialPriceMap[componentKey]
          if (price === undefined) return
          hasAnyCost = true
          const unitOfMeasure = materialUnitMap[componentKey] || 'stuks'
          costPerItem += getMaterialCostForComponent(component, price, unitOfMeasure)
        })

        if (!hasAnyCost) return

        const existing = latestCosts[normalizedLineNumber]
        if (!existing || new Date(uploadedAt) > new Date(existing.uploadedAt)) {
          latestCosts[normalizedLineNumber] = { cost: costPerItem, uploadedAt }
        }
      })

      materialCostMap = Object.keys(latestCosts).reduce((acc: Record<string, number>, key) => {
        acc[key] = latestCosts[key].cost
        return acc
      }, {})
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
    const date = new Date(item.date_packed).toISOString().split('T')[0]
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
    const amount = item.amount || 0
    dailyStats[date].itemsPacked += amount

    const price = pricesMap[normalizeItemNumber(item.item_number)] || 0
    dailyStats[date].revenue += price * amount

    const materialUnitCost = materialCostMap[normalizeItemNumber(item.item_number)] || 0
    dailyStats[date].materialCost += materialUnitCost * amount
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
    const date = toDateKey(item.date_added) || toDateKey(item.date_packed)
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
    const amount = item.amount || 0
    dailyStats[date].incomingItems += amount
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
    const price = pricesMap[normalizeItemNumber(item.item_number)] || 0
    const amount = item.amount || 0
    return sum + price * amount
  }, 0)

  const totalMaterialCost = items.reduce((sum, item: any) => {
    const unitCost = materialCostMap[normalizeItemNumber(item.item_number)] || 0
    const amount = item.amount || 0
    return sum + unitCost * amount
  }, 0)

  const totalIncoming = incoming.reduce((sum, item: any) => sum + (item.amount || 0), 0)
  const incomingVsPackedRatio =
    totalItemsPacked > 0 ? Number((totalIncoming / totalItemsPacked).toFixed(2)) : null

  const leadTimes = items
    .map((item: any) => {
      if (!item.date_added || !item.date_packed) return null
      const added = new Date(item.date_added)
      const packed = new Date(item.date_packed)
      if (!Number.isFinite(added.getTime()) || !Number.isFinite(packed.getTime()) || packed <= added) {
        return null
      }
      const businessDays = calculateBusinessDays(added, packed)
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

  const detailedItems: DetailedItem[] = skipDetails
    ? []
    : items
        .map((item: any) => {
          const price = pricesMap[normalizeItemNumber(item.item_number)] || 0
          const amount = item.amount || 0
          const revenue = price * amount
          const materialUnitCost = materialCostMap[normalizeItemNumber(item.item_number)] || 0
          const materialCostTotal = materialUnitCost * amount

          return {
            id: item.id,
            item_number: item.item_number,
            po_number: item.po_number,
            amount,
            price: Number(price.toFixed(2)),
            revenue: Number(revenue.toFixed(2)),
            materialCostUnit: Number(materialUnitCost.toFixed(2)),
            materialCostTotal: Number(materialCostTotal.toFixed(2)),
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
    detailsLimited: skipDetails,
  }
}
