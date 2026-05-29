import type { CostingUnit } from '@/lib/pricing-engine/component-engine'

/** Map pricing_materials.unit (DB) naar reken-eenheid van de component-engine. */
export function unitToCostingUnit(unit: string): CostingUnit {
  const u = String(unit || '').trim().toLowerCase()
  if (u === 'm3' || u === 'm³') return 'm3'
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'm' || u === 'meter') return 'meter'
  if (u === 'kg') return 'kg'
  if (u === 'st' || u === 'stuks' || u === 'piece' || u === 'pce') return 'piece'
  return 'piece'
}
