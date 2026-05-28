export interface PricingBreakdownLine {
  label: string
  amount: number
}

export interface ExtraMaterialInputLine {
  material_id: string
  quantity_per_unit: number
}

export type {
  PalletComponentInput,
  PalletDimensionsInput,
  PalletComponentKey,
} from '@/lib/pricing-engine/pallet-dimensions'

export interface PalletPricingInput {
  quantity: number
  /** Maatvoering per onderdeel (aanbevolen) */
  dimensions?: import('@/lib/pricing-engine/pallet-dimensions').PalletDimensionsInput
  /** Fallback: manueel totaal volume per pallet (m³) als geen dimensions */
  wood_volume_m3?: number
  /** Standaard houtsoort voor alle onderdelen zonder eigen houtsoort */
  wood_material_id?: string
  wood_cost_per_m3?: number
  extra_materials?: ExtraMaterialInputLine[]
  extra_material_cost_per_unit?: number
  labor_minutes_per_unit: number
  labor_cost_per_hour: number
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
  meta?: {
    wood_type?: string
    wood_cost_per_m3?: number
    wood_volume_m3_per_pallet?: number
    wood_volume_m3_total?: number
    components?: Array<{
      key: string
      label: string
      count: number
      volume_m3_per_pallet: number
      wood_type?: string
    }>
    extra_lines?: Array<{ name: string; unit: string; qty_per_unit: number; cost_per_unit: number }>
  }
}

export type PricingCalculatorInput = PalletPricingInput & Record<string, unknown>
