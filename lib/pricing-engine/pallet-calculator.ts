import type { PalletPricingInput, PricingResult } from '@/lib/pricing-engine/types'
import {
  assertNonNegative,
  assertPositive,
  assertRequired,
  roundMoney,
} from '@/lib/pricing-engine/utils'

/**
 * Pallet-prijsberekening — vaste formules, geen AI.
 * Later: houtvolume kan afgeleid worden uit BC-stamgegevens of materiaaltabel.
 */
export function calculatePalletPrice(raw: PalletPricingInput): PricingResult {
  assertRequired(raw.quantity, 'Aantal')
  const quantity = assertPositive(raw.quantity, 'Aantal')

  assertRequired(raw.wood_volume_m3, 'Houtvolume (m³)')
  const woodVolumeM3 = assertNonNegative(raw.wood_volume_m3, 'Houtvolume (m³)')
  const woodCostPerM3 = assertNonNegative(raw.wood_cost_per_m3, 'Houtkost per m³')

  const laborMinutesPerUnit = assertNonNegative(raw.labor_minutes_per_unit, 'Arbeid minuten per stuk')
  const laborCostPerHour = assertNonNegative(raw.labor_cost_per_hour, 'Arbeidskost per uur')
  const extraMaterialPerUnit = assertNonNegative(raw.extra_material_cost_per_unit, 'Extra materiaalkost per stuk')
  const transportCost = assertNonNegative(raw.transport_cost, 'Transportkost')
  const overheadPct = assertNonNegative(raw.overhead_percentage, 'Overheadpercentage')
  const marginPct = assertNonNegative(raw.margin_percentage, 'Margepercentage')

  // Hout / materiaal (volgens vaste pallet-formule)
  const materialCost = roundMoney(woodVolumeM3 * woodCostPerM3)

  // Arbeid: aantal × (minuten/60) × uurloon
  const laborCost = roundMoney(quantity * (laborMinutesPerUnit / 60) * laborCostPerHour)

  const extraMaterialCost = roundMoney(quantity * extraMaterialPerUnit)

  const baseCost = roundMoney(materialCost + laborCost + extraMaterialCost + transportCost)
  const overheadCost = roundMoney(baseCost * (overheadPct / 100))
  const totalCost = roundMoney(baseCost + overheadCost)
  const marginAmount = roundMoney(totalCost * (marginPct / 100))
  const salesPrice = roundMoney(totalCost + marginAmount)
  const pricePerUnit = roundMoney(salesPrice / quantity)

  return {
    materialCost,
    laborCost,
    extraMaterialCost,
    transportCost: roundMoney(transportCost),
    overheadCost,
    totalCost,
    marginAmount,
    salesPrice,
    pricePerUnit,
    breakdown: [
      { label: 'Hout / materiaal', amount: materialCost },
      { label: 'Arbeid', amount: laborCost },
      { label: 'Extra materiaal', amount: extraMaterialCost },
      { label: 'Transport', amount: roundMoney(transportCost) },
      { label: 'Overhead', amount: overheadCost },
      { label: 'Marge', amount: marginAmount },
    ],
  }
}
