/**
 * Test pallet calculator (zelfde formules als lib/pricing-engine/pallet-calculator.ts)
 * Run: node scripts/test-pricing-pallet.mjs
 */

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function calculatePalletPrice(input) {
  const quantity = input.quantity
  const materialCost = roundMoney(input.wood_volume_m3 * input.wood_cost_per_m3)
  const laborCost = roundMoney(quantity * (input.labor_minutes_per_unit / 60) * input.labor_cost_per_hour)
  const extraMaterialCost = roundMoney(quantity * input.extra_material_cost_per_unit)
  const transportCost = roundMoney(input.transport_cost)
  const baseCost = roundMoney(materialCost + laborCost + extraMaterialCost + transportCost)
  const overheadCost = roundMoney(baseCost * (input.overhead_percentage / 100))
  const totalCost = roundMoney(baseCost + overheadCost)
  const marginAmount = roundMoney(totalCost * (input.margin_percentage / 100))
  const salesPrice = roundMoney(totalCost + marginAmount)
  const pricePerUnit = roundMoney(salesPrice / quantity)
  return { materialCost, laborCost, extraMaterialCost, transportCost, overheadCost, totalCost, marginAmount, salesPrice, pricePerUnit }
}

const resolved = {
  wood: { id: '1', code: 'SXT', name: 'Sexta (SXT)', costPerM3: 380 },
  extras: [
    { id: '2', code: 'EXTRA_SPIJKERS', name: 'Spijkers', unit: 'st', costPerUnit: 0.08, quantityPerUnit: 2 },
    { id: '3', code: 'EXTRA_SPANBAND', name: 'Spanband', unit: 'st', costPerUnit: 0.45, quantityPerUnit: 1 },
  ],
}

function calculateWithResolved(input, resolved) {
  const quantity = input.quantity
  const materialCost = roundMoney(input.wood_volume_m3 * resolved.wood.costPerM3)
  const laborCost = roundMoney(quantity * (input.labor_minutes_per_unit / 60) * input.labor_cost_per_hour)
  let extraMaterialCost = 0
  for (const line of resolved.extras) {
    extraMaterialCost += roundMoney(quantity * line.quantityPerUnit * line.costPerUnit)
  }
  extraMaterialCost = roundMoney(extraMaterialCost)
  const transportCost = roundMoney(input.transport_cost)
  const baseCost = roundMoney(materialCost + laborCost + extraMaterialCost + transportCost)
  const overheadCost = roundMoney(baseCost * (input.overhead_percentage / 100))
  const totalCost = roundMoney(baseCost + overheadCost)
  const marginAmount = roundMoney(totalCost * (input.margin_percentage / 100))
  const salesPrice = roundMoney(totalCost + marginAmount)
  const pricePerUnit = roundMoney(salesPrice / quantity)
  return { materialCost, laborCost, extraMaterialCost, transportCost, overheadCost, totalCost, marginAmount, salesPrice, pricePerUnit }
}

const input = {
  quantity: 100,
  wood_volume_m3: 0.05,
  labor_minutes_per_unit: 12,
  labor_cost_per_hour: 45,
  transport_cost: 150,
  overhead_percentage: 8,
  margin_percentage: 15,
}

const r = calculateWithResolved(input, resolved)
console.log('Pallet test (SXT + extras):', r)

// 0.05 * 380 = 19, labor 900, extras: 100*2*0.08 + 100*1*0.45 = 16+45 = 61
const ok =
  r.materialCost === 19 &&
  r.laborCost === 900 &&
  r.extraMaterialCost === 61 &&
  r.transportCost === 150 &&
  r.overheadCost === 90.4 &&
  r.totalCost === 1220.4 &&
  r.marginAmount === 183.06 &&
  r.salesPrice === 1403.46 &&
  r.pricePerUnit === 14.03

console.log(ok ? 'PASS' : 'FAIL', '(verwachte afronding op 2 decimalen)')
