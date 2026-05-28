export interface PricingBreakdownLine {
  label: string
  amount: number
}

export interface PalletPricingInput {
  quantity: number
  length_mm?: number
  width_mm?: number
  height_mm?: number
  wood_volume_m3: number
  wood_cost_per_m3: number
  labor_minutes_per_unit: number
  labor_cost_per_hour: number
  extra_material_cost_per_unit: number
  transport_cost: number
  overhead_percentage: number
  margin_percentage: number
}

export interface PricingResult {
  materialCost: number
  laborCost: number
  extraMaterialCost: number
  transportCost: number
  overheadCost: number
  totalCost: number
  marginAmount: number
  salesPrice: number
  pricePerUnit: number
  breakdown: PricingBreakdownLine[]
}

export type PricingCalculatorInput = PalletPricingInput & Record<string, unknown>
