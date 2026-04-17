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
  itemsPacked: number
  revenue: number
  materialCost: number
  itemsPerHour: number
  revenuePerHour: number
}

export interface DetailedItem {
  id: number
  item_number: string
  description?: string | null
  po_number: string
  amount: number
  price: number
  priceFound: boolean
  revenue: number
  materialCostUnit: number
  materialCostTotal: number
  date_packed: string
  date_added: string
  packed_by_name?: string | null
}

export type DetailSortColumn = keyof Pick<DetailedItem,
  'date_packed' | 'item_number' | 'po_number' | 'amount' | 'price' | 'revenue' | 'materialCostUnit' | 'materialCostTotal'
>

export type CompareMode = 'previous' | 'lastYear' | 'custom' | 'selectedDays'

export type Aggregation = 'day' | 'week' | 'month'

export interface AggregatedStat extends DailyStat {
  periodStart: string
  periodEnd: string
  periodLabel: string
  periodKey: string
  workingDaysInBucket: number
}

export interface TopItemStat {
  item_number: string
  description?: string | null
  totalAmount: number
  totalRevenue: number
  totalMaterialCost: number
  grossMargin: number
  marginPct: number | null
  missingPrice: boolean
}

export interface WeekdayStat {
  weekdayIndex: number
  label: string
  avgItemsPacked: number
  avgManHours: number
  avgItemsPerFte: number
  avgRevenue: number
  daysCounted: number
}

export interface MissingDataStat {
  itemsWithoutPrice: number
  itemsWithoutMaterialCost: number
  totalItemsInPeriod: number
  estimatedLostRevenueHint: string | null
}

export interface PrepackTargets {
  dailyItems: number | null
  dailyRevenue: number | null
}

export type SectionKey =
  | 'filters'
  | 'chartOutput'
  | 'chartRevenue'
  | 'chartMaterial'
  | 'chartIncoming'
  | 'productivity'
  | 'people'
  | 'details'
  | 'daily'
  | 'topItems'
  | 'weekday'
