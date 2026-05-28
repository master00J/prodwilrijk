'use client'

import {
  PALLET_COMPONENT_KEYS,
  PALLET_COMPONENT_LABELS,
  previewWoodVolumePerPallet,
  type PalletComponentKey,
  type PalletDimensionsInput,
} from '@/lib/pricing-engine/pallet-dimensions'
import type { PricingMaterialOption } from '@/lib/pricing/client'

interface Props {
  dimensions: PalletDimensionsInput
  onChange: (next: PalletDimensionsInput) => void
  woodTypes: PricingMaterialOption[]
  defaultWoodMaterialId: string
  disabled?: boolean
}

function updateComponent(
  dimensions: PalletDimensionsInput,
  key: PalletComponentKey,
  field: string,
  value: string,
): PalletDimensionsInput {
  const current = dimensions.components[key] ?? {
    count: 0,
    length_mm: 0,
    width_mm: 0,
    thickness_mm: 0,
  }
  if (field === 'wood_material_id') {
    const next = { ...current, wood_material_id: value || undefined }
    return { ...dimensions, components: { ...dimensions.components, [key]: next } }
  }
  const num = value === '' ? 0 : Number(value)
  return {
    ...dimensions,
    components: {
      ...dimensions.components,
      [key]: { ...current, [field]: num },
    },
  }
}

export default function PalletDimensionsForm({
  dimensions,
  onChange,
  woodTypes,
  defaultWoodMaterialId,
  disabled,
}: Props) {
  const volumePreview = previewWoodVolumePerPallet(dimensions)

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900">Maatvoering pallet</h3>
        <p className="text-xs text-amber-800 tabular-nums">
          Houtvolume: <strong>{volumePreview.toFixed(4)}</strong> m³ / pallet (indicatief)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500">Pallet lengte (mm)</span>
          <input
            type="number"
            value={dimensions.pallet_length_mm ?? ''}
            onChange={(e) => onChange({ ...dimensions, pallet_length_mm: Number(e.target.value) || undefined })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Pallet breedte (mm)</span>
          <input
            type="number"
            value={dimensions.pallet_width_mm ?? ''}
            onChange={(e) => onChange({ ...dimensions, pallet_width_mm: Number(e.target.value) || undefined })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {PALLET_COMPONENT_KEYS.map((key) => {
        const c = dimensions.components[key]
        const count = c?.count ?? 0
        const active = count > 0

        return (
          <div
            key={key}
            className={`rounded-lg border p-3 ${active ? 'border-amber-200 bg-white' : 'border-gray-200 bg-gray-50/80'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">{PALLET_COMPONENT_LABELS[key]}</span>
              <span className="text-[10px] text-gray-400">{active ? `${count} st/pallet` : 'uit'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <label className="block">
                <span className="text-[10px] text-gray-500">Aantal</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={c?.count ?? 0}
                  onChange={(e) => onChange(updateComponent(dimensions, key, 'count', e.target.value))}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Lengte mm</span>
                <input
                  type="number"
                  min="0"
                  value={c?.length_mm ?? ''}
                  onChange={(e) => onChange(updateComponent(dimensions, key, 'length_mm', e.target.value))}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Breedte mm</span>
                <input
                  type="number"
                  min="0"
                  value={c?.width_mm ?? ''}
                  onChange={(e) => onChange(updateComponent(dimensions, key, 'width_mm', e.target.value))}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Dikte mm</span>
                <input
                  type="number"
                  min="0"
                  value={c?.thickness_mm ?? ''}
                  onChange={(e) => onChange(updateComponent(dimensions, key, 'thickness_mm', e.target.value))}
                  disabled={disabled}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block sm:col-span-1 col-span-2">
                <span className="text-[10px] text-gray-500">Houtsoort</span>
                <select
                  value={c?.wood_material_id ?? ''}
                  onChange={(e) => onChange(updateComponent(dimensions, key, 'wood_material_id', e.target.value))}
                  disabled={disabled || !active}
                  className="mt-0.5 w-full rounded border border-gray-300 px-1 py-1 text-xs bg-white"
                >
                  <option value="">Standaard ({defaultWoodMaterialId ? '…' : 'kies boven'})</option>
                  {woodTypes.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
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
