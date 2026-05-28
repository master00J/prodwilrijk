import type { PalletPricingInput, PricingResult } from '@/lib/pricing-engine/types'
import {
  computePalletComponents,
  totalWoodVolumePerPallet,
} from '@/lib/pricing-engine/pallet-dimensions'
import type { ResolvedPalletMaterials } from '@/lib/pricing/resolve-materials'
import {
  assertNonNegative,
  assertPositive,
  assertRequired,
  roundMoney,
} from '@/lib/pricing-engine/utils'

/**
 * Pallet-prijsberekening — vaste formules, geen AI.
 * Houtvolume uit maatvoering (onderdelen) × aantal pallets × kost/m³ per houtsoort.
 */
export function calculatePalletPrice(
  raw: PalletPricingInput,
  resolved?: ResolvedPalletMaterials,
): PricingResult {
  assertRequired(raw.quantity, 'Aantal')
  const quantity = assertPositive(raw.quantity, 'Aantal')

  const laborMinutesPerUnit = assertNonNegative(raw.labor_minutes_per_unit, 'Arbeid minuten per stuk')
  const laborCostPerHour = assertNonNegative(raw.labor_cost_per_hour, 'Arbeidskost per uur')
  const transportCost = assertNonNegative(raw.transport_cost, 'Transportkost')
  const overheadPct = assertNonNegative(raw.overhead_percentage, 'Overheadpercentage')
  const marginPct = assertNonNegative(raw.margin_percentage, 'Margepercentage')

  const woodBreakdown: PricingResult['breakdown'] = []
  let materialCost = 0
  let volumePerPallet = 0
  const componentMeta: NonNullable<PricingResult['meta']>['components'] = []

  if (resolved?.woodLines && resolved.woodLines.length > 0) {
    for (const line of resolved.woodLines) {
      const lineCost = roundMoney(quantity * line.volumeM3PerPallet * line.wood.costPerM3)
      materialCost += lineCost
      volumePerPallet += line.volumeM3PerPallet
      woodBreakdown.push({
        label: `${line.componentLabel} (${line.count} st, ${line.volumeM3PerPallet.toFixed(4)} m³/pallet × ${line.wood.name})`,
        amount: lineCost,
      })
      componentMeta.push({
        key: line.componentKey,
        label: line.componentLabel,
        count: line.count,
        volume_m3_per_pallet: line.volumeM3PerPallet,
        wood_type: line.wood.name,
      })
    }
    materialCost = roundMoney(materialCost)
  } else if (raw.dimensions) {
    const computed = computePalletComponents(raw.dimensions)
    volumePerPallet = totalWoodVolumePerPallet(computed)
    throw new Error('Maatvoering kon niet worden gekoppeld aan houtsoorten in masterdata')
  } else {
    assertRequired(raw.wood_volume_m3, 'Maatvoering of houtvolume (m³)')
    volumePerPallet = assertNonNegative(raw.wood_volume_m3, 'Houtvolume (m³)')

    let woodCostPerM3: number
    let woodLabel = 'Hout / materiaal'

    if (resolved?.wood) {
      woodCostPerM3 = resolved.wood.costPerM3
      woodLabel = `Hout — ${resolved.wood.name}`
    } else if (raw.wood_material_id) {
      throw new Error('Houtsoort kon niet worden opgelost uit masterdata')
    } else {
      assertRequired(raw.wood_cost_per_m3, 'Houtsoort of houtkost per m³')
      woodCostPerM3 = assertNonNegative(raw.wood_cost_per_m3, 'Houtkost per m³')
      woodLabel = 'Hout (handmatig)'
    }

    materialCost = roundMoney(quantity * volumePerPallet * woodCostPerM3)
    woodBreakdown.push({
      label: `${woodLabel} (${volumePerPallet} m³/pallet × ${quantity} st)`,
      amount: materialCost,
    })
  }

  const laborCost = roundMoney(quantity * (laborMinutesPerUnit / 60) * laborCostPerHour)

  const breakdownExtras: PricingResult['breakdown'] = []
  let extraMaterialCost = 0

  if (resolved?.extras && resolved.extras.length > 0) {
    for (const line of resolved.extras) {
      const lineTotal = roundMoney(quantity * line.quantityPerUnit * line.costPerUnit)
      extraMaterialCost += lineTotal
      breakdownExtras.push({
        label: `Extra — ${line.name} (${line.quantityPerUnit} ${line.unit}/st × ${quantity} st)`,
        amount: lineTotal,
      })
    }
    extraMaterialCost = roundMoney(extraMaterialCost)
  } else if (raw.extra_materials && raw.extra_materials.length > 0) {
    throw new Error('Extra materialen konden niet worden opgelost uit masterdata')
  } else {
    const perUnit = assertNonNegative(raw.extra_material_cost_per_unit ?? 0, 'Extra materiaalkost per stuk')
    extraMaterialCost = roundMoney(quantity * perUnit)
    if (extraMaterialCost > 0) {
      breakdownExtras.push({ label: 'Extra materiaal (totaal)', amount: extraMaterialCost })
    }
  }

  const baseCost = roundMoney(materialCost + laborCost + extraMaterialCost + transportCost)
  const overheadCost = roundMoney(baseCost * (overheadPct / 100))
  const totalCost = roundMoney(baseCost + overheadCost)
  const marginAmount = roundMoney(totalCost * (marginPct / 100))
  const salesPrice = roundMoney(totalCost + marginAmount)
  const pricePerUnit = roundMoney(salesPrice / quantity)

  const primaryWood = resolved?.woodLines[0]?.wood ?? resolved?.wood

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
      ...woodBreakdown,
      { label: 'Arbeid', amount: laborCost },
      ...breakdownExtras,
      { label: 'Transport', amount: roundMoney(transportCost) },
      { label: 'Overhead', amount: overheadCost },
      { label: 'Marge', amount: marginAmount },
    ],
    meta: {
      wood_type: primaryWood?.name,
      wood_cost_per_m3: primaryWood?.costPerM3,
      wood_volume_m3_per_pallet: roundMoney(volumePerPallet),
      wood_volume_m3_total: roundMoney(volumePerPallet * quantity),
      components: componentMeta.length > 0 ? componentMeta : undefined,
      extra_lines: resolved?.extras.map((e) => ({
        name: e.name,
        unit: e.unit,
        qty_per_unit: e.quantityPerUnit,
        cost_per_unit: e.costPerUnit,
      })),
    },
  }
}
