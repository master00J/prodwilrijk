export type ManagedOrder = {
  id: number
  order_number: string
  sales_order_number: string | null
  uploaded_at: string
  finished_at: string | null
  site: string
}

export type StepHours = { step: string; hours: number }
export type EmployeeHours = { employee_name: string; hours: number }

export type RevenueRun = {
  item_number: string
  order_number: string
  date: string
  quantity: number
  hours: number
  hours_per_piece: number
  steps: StepHours[]
  employees: EmployeeHours[]
  sales_price: number | null
  revenue: number | null
  material_cost_per_item: number
  material_cost_total: number
  margin: number | null
  description: string | null
}

export type ActiveSession = {
  id: number
  employee_name: string
  order_number: string
  item_number: string
  step: string
  elapsed_seconds: number
}

export type RevenueTotals = {
  total_revenue: number
  total_material_cost: number
  total_hours: number
  total_margin: number
}

export type KpiKeyValue = { key: string; hours: number }

export type KpiData = {
  orders: KpiKeyValue[]
  steps: KpiKeyValue[]
  employees: KpiKeyValue[]
  items: KpiKeyValue[]
  zaagByDate: { date: string; hours: number }[]
  dailyStepHours: { date: string; step: string; hours: number }[]
}

export type DerivedKpis = {
  totalQuantity: number
  runCount: number
  uniqueOrders: number
  uniqueItems: number
  uniqueEmployees: number
  avgHoursPerPiece: number
  marginPct: number | null
  materialPct: number | null
  revenuePerHour: number | null
  marginPerHour: number | null
  avgRevenuePerRun: number | null
  zaagHours: number
  activeStepCount: number
}

export type DailyFinancial = {
  date: string
  revenue: number
  margin: number
  hours: number
  material: number
}

export type DailyHours = {
  date: string
  hours: number
}
