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

const input = {
  quantity: 100,
  wood_volume_m3: 0.05,
  wood_cost_per_m3: 350,
  labor_minutes_per_unit: 12,
  labor_cost_per_hour: 45,
  extra_material_cost_per_unit: 2.5,
  transport_cost: 150,
  overhead_percentage: 8,
  margin_percentage: 15,
}

const r = calculatePalletPrice(input)
console.log('Pallet test result:', r)

const ok =
  r.materialCost === 17.5 &&
  r.laborCost === 900 &&
  r.extraMaterialCost === 250 &&
  r.transportCost === 150 &&
  r.overheadCost === 105.4 &&
  r.totalCost === 1422.9 &&
  r.marginAmount === 213.44 &&
  r.salesPrice === 1636.34 &&
  r.pricePerUnit === 16.36

console.log(ok ? 'PASS' : 'FAIL', '(verwachte afronding op 2 decimalen)')
