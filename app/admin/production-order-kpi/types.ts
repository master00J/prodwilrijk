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
  start_time?: string
  site?: string
  quantity?: number | null
}

export type ActiveOrderGroup = {
  order_number: string
  site: string
  sessions: ActiveSession[]
  workers: string[]
  items: string[]
  steps: string[]
  maxElapsed: number
  earliestStart: string | null
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
  totalHours: number
  runCount: number
  uniqueOrders: number
  uniqueItems: number
  uniqueEmployees: number
  avgHoursPerPiece: number
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

export type ItemRunComparison = {
  run: RevenueRun
  hoursPerPieceDelta: number
  hoursPerPieceDeltaPct: number
  marginDelta: number | null
  marginDeltaPct: number | null
  employeesLabel: string
  isFastest: boolean
  isSlowest: boolean
}

export type ItemAnalysis = {
  item_number: string
  description: string | null
  runs: RevenueRun[]
  runCount: number
  orderCount: number
  employeeCount: number
  totalQuantity: number
  totalHours: number
  hoursPerPiece: {
    min: number
    max: number
    avg: number
    spread: number
    spreadPct: number
  }
  margin: {
    min: number | null
    max: number | null
    avg: number | null
    spread: number | null
  } | null
  employees: { name: string; hours: number; runCount: number }[]
  orders: { order_number: string; runs: number; hours: number; hoursPerPiece: number }[]
  steps: { step: string; hours: number }[]
  runComparisons: ItemRunComparison[]
}
