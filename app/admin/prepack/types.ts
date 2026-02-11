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

export type CompareMode = 'previous' | 'lastYear' | 'custom' | 'selectedDays'

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
