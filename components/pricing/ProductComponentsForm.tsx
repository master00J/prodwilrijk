'use client'

import type { ComponentInput } from '@/lib/pricing-engine/component-engine'
import type { CostingUnit } from '@/lib/pricing-engine/component-engine'
import { componentQuantity } from '@/lib/pricing-engine/component-engine'
import type { ProductTemplate } from '@/lib/pricing-engine/product-templates'
import type { PricingMaterialOption } from '@/lib/pricing/client'
import { unitToCostingUnit } from '@/lib/pricing/material-unit'

const UNIT_LABEL: Record<CostingUnit, string> = {
  m3: 'm³',
  m2: 'm²',
  meter: 'm',
  kg: 'kg',
  piece: 'st',
}

interface Props {
  template: ProductTemplate
  components: ComponentInput[]
  onChange: (next: ComponentInput[]) => void
  materialsByCategory: Record<string, PricingMaterialOption[]>
  defaultMaterialId: string
  disabled?: boolean
}

function updateComponent(
  list: ComponentInput[],
  key: string,
  field: keyof ComponentInput,
  value: string | number,
): ComponentInput[] {
  return list.map((c) => {
    if (c.key !== key) return c
    if (field === 'material_id') {
      return { ...c, material_id: String(value) || undefined }
    }
    if (field === 'label') {
      return { ...c, label: String(value) }
    }
    const num = value === '' ? 0 : Number(value)
    return { ...c, [field]: num }
  })
}

function previewQty(
  comp: ComponentInput,
  materials: PricingMaterialOption[],
  defaultMaterialId: string,
): string | null {
  const materialId = comp.material_id || defaultMaterialId
  const mat = materials.find((m) => m.id === materialId)
  if (!mat || (comp.count ?? 0) <= 0) return null
  try {
    const costingUnit = unitToCostingUnit(mat.unit)
    const qty = componentQuantity(comp, {
      id: mat.id,
      name: mat.name,
      costing_unit: costingUnit,
      cost_per_unit: 0,
    })
    const u = UNIT_LABEL[costingUnit]
    return `${qty.toFixed(4)} ${u}/stuk`
  } catch {
    return null
  }
}

export default function ProductComponentsForm({
  template,
  components,
  onChange,
  materialsByCategory,
  defaultMaterialId,
  disabled,
}: Props) {
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-4">
      <h3 className="text-sm font-semibold text-amber-900">Componenten — {template.label}</h3>

      {template.slots.map((slot) => {
        const comp = components.find((c) => c.key === slot.key) ?? {
          key: slot.key,
          label: slot.label,
          count: 0,
        }
        const active = (comp.count ?? 0) > 0
        const categoryMaterials = materialsByCategory[slot.materialCategory] ?? []
        const preview = previewQty(comp, categoryMaterials, defaultMaterialId)

        return (
          <div
            key={slot.key}
            className={`rounded-lg border p-3 ${active ? 'border-amber-200 bg-white' : 'border-gray-200 bg-gray-50/80'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">{slot.label}</span>
              {preview && (
                <span className="text-[10px] text-amber-800 tabular-nums">{preview}</span>
              )}
            </div>
            {slot.help && <p className="text-[10px] text-gray-500 mb-2">{slot.help}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <label className="block">
                <span className="text-[10px] text-gray-500">Aantal</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={comp.count ?? 0}
                  onChange={(e) => onChange(updateComponent(components, slot.key, 'count', e.target.value))}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>

              {slot.dims.includes('length') && (
                <label className="block">
                  <span className="text-[10px] text-gray-500">Lengte mm</span>
                  <input
                    type="number"
                    min="0"
                    value={comp.length_mm ?? ''}
                    onChange={(e) => onChange(updateComponent(components, slot.key, 'length_mm', e.target.value))}
                    disabled={disabled || !active}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              )}

              {slot.dims.includes('width') && (
                <label className="block">
                  <span className="text-[10px] text-gray-500">Breedte mm</span>
                  <input
                    type="number"
                    min="0"
                    value={comp.width_mm ?? ''}
                    onChange={(e) => onChange(updateComponent(components, slot.key, 'width_mm', e.target.value))}
                    disabled={disabled || !active}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              )}

              {slot.dims.includes('thickness') && (
                <label className="block">
                  <span className="text-[10px] text-gray-500">Dikte mm</span>
                  <input
                    type="number"
                    min="0"
                    value={comp.thickness_mm ?? ''}
                    onChange={(e) => onChange(updateComponent(components, slot.key, 'thickness_mm', e.target.value))}
                    disabled={disabled || !active}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              )}

              <label className="block sm:col-span-1 col-span-2">
                <span className="text-[10px] text-gray-500">Materiaal</span>
                <select
                  value={comp.material_id ?? ''}
                  onChange={(e) => onChange(updateComponent(components, slot.key, 'material_id', e.target.value))}
                  disabled={disabled || !active || categoryMaterials.length === 0}
                  className="mt-0.5 w-full rounded border border-gray-300 px-1 py-1 text-xs bg-white"
                >
                  <option value="">Standaard</option>
                  {categoryMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
