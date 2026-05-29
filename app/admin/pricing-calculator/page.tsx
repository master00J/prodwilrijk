'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'
import ProductComponentsForm from '@/components/pricing/ProductComponentsForm'
import PricingResultCard from '@/components/pricing/PricingResultCard'
import type { ComponentInput } from '@/lib/pricing-engine/component-engine'
import {
  emptyComponentsForTemplate,
  getTemplate,
  hasProductTemplate,
} from '@/lib/pricing-engine/product-templates'
import type { PricingResult } from '@/lib/pricing-engine/types'
import {
  calculatePriceApi,
  fetchMaterials,
  fetchPlants,
  fetchProductTypes,
  formatEuro,
  saveSimulation,
  type PricingMaterialOption,
  type PricingMasterOption,
} from '@/lib/pricing/client'
import { Calculator, History, Loader2, Plus, Trash2 } from 'lucide-react'

interface ExtraLineForm {
  key: string
  material_id: string
  quantity_per_unit: string
}

const defaultForm = {
  customer_name: '',
  quantity: '100',
  default_material_id: '',
  labor_minutes_per_unit: '12',
  labor_cost_per_hour: '45',
  transport_cost: '150',
  overhead_percentage: '8',
  margin_percentage: '15',
}

function newExtraLine(): ExtraLineForm {
  return { key: `e-${Date.now()}-${Math.random()}`, material_id: '', quantity_per_unit: '1' }
}

export default function PricingCalculatorPage() {
  const [plants, setPlants] = useState<PricingMasterOption[]>([])
  const [productTypes, setProductTypes] = useState<PricingMasterOption[]>([])
  const [allMaterials, setAllMaterials] = useState<PricingMaterialOption[]>([])
  const [plantId, setPlantId] = useState('')
  const [productTypeId, setProductTypeId] = useState('')
  const [form, setForm] = useState(defaultForm)
  const [components, setComponents] = useState<ComponentInput[]>([])
  const [extraLines, setExtraLines] = useState<ExtraLineForm[]>([newExtraLine()])
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingResult | null>(null)
  const [savedNumber, setSavedNumber] = useState<string | null>(null)

  const selectedProduct = useMemo(
    () => productTypes.find((p) => p.id === productTypeId),
    [productTypes, productTypeId],
  )

  const template = useMemo(
    () => (selectedProduct ? getTemplate(selectedProduct.code) : undefined),
    [selectedProduct],
  )

  const hasCalculator = Boolean(template)

  const materialsByCategory = useMemo(() => {
    const map: Record<string, PricingMaterialOption[]> = {}
    for (const m of allMaterials) {
      const cat = m.category || 'overig'
      map[cat] = [...(map[cat] || []), m]
    }
    return map
  }, [allMaterials])

  const defaultWoodMaterials = materialsByCategory.houtsoort ?? []

  useEffect(() => {
    Promise.all([fetchPlants(), fetchProductTypes()])
      .then(([p, pt]) => {
        setPlants(p)
        setProductTypes(pt)
        const wilrijk = p.find((x) => x.code === 'WILRIJK')
        const pallet = pt.find((x) => x.code === 'PALLET')
        if (wilrijk) setPlantId(wilrijk.id)
        if (pallet) setProductTypeId(pallet.id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMaster(false))
  }, [])

  useEffect(() => {
    if (!plantId) {
      setAllMaterials([])
      return
    }
    setLoadingMaterials(true)
    fetchMaterials(plantId)
      .then((materials) => {
        setAllMaterials(materials)
        const wood = materials.filter((m) => m.category === 'houtsoort')
        setForm((f) => ({
          ...f,
          default_material_id:
            f.default_material_id && wood.some((w) => w.id === f.default_material_id)
              ? f.default_material_id
              : wood[0]?.id ?? '',
        }))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMaterials(false))
  }, [plantId])

  useEffect(() => {
    if (!selectedProduct) {
      setComponents([])
      return
    }
    if (hasProductTemplate(selectedProduct.code)) {
      setComponents(emptyComponentsForTemplate(selectedProduct.code))
      setResult(null)
      setSavedNumber(null)
    }
  }, [selectedProduct?.code, selectedProduct?.id])

  const setField = (key: keyof typeof defaultForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSavedNumber(null)
  }

  const buildInput = useCallback(() => {
    const extra_materials = extraLines
      .filter((l) => l.material_id && Number(l.quantity_per_unit) > 0)
      .map((l) => ({
        material_id: l.material_id,
        quantity_per_unit: Number(l.quantity_per_unit),
      }))

    const activeComponents = components.filter((c) => (c.count ?? 0) > 0)

    return {
      quantity: Number(form.quantity),
      components: activeComponents,
      wood_material_id: form.default_material_id || undefined,
      extra_materials: extra_materials.length > 0 ? extra_materials : undefined,
      labor_minutes_per_unit: Number(form.labor_minutes_per_unit),
      labor_cost_per_hour: Number(form.labor_cost_per_hour),
      transport_cost: Number(form.transport_cost),
      overhead_percentage: Number(form.overhead_percentage),
      margin_percentage: Number(form.margin_percentage),
    }
  }, [form, components, extraLines])

  const handleCalculate = useCallback(async () => {
    if (!selectedProduct || !template) {
      setError('Kies een producttype met calculator')
      return
    }

    const active = components.filter((c) => (c.count ?? 0) > 0)
    if (active.length === 0) {
      setError('Voeg minstens één actief component toe (aantal > 0)')
      return
    }

    const needsDefault = active.some((c) => !c.material_id)
    if (needsDefault && !form.default_material_id) {
      setError('Kies een standaard materiaal of wijs per component een materiaal toe')
      return
    }

    setCalculating(true)
    setError(null)
    setSavedNumber(null)
    try {
      const res = await calculatePriceApi(selectedProduct.code, buildInput(), plantId)
      setResult(res)
    } catch (e: unknown) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Berekening mislukt')
    } finally {
      setCalculating(false)
    }
  }, [buildInput, plantId, selectedProduct, template, components, form.default_material_id])

  const handleSave = async () => {
    if (!selectedProduct || !result) {
      setError('Bereken eerst een prijs voordat je opslaat')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await saveSimulation({
        customer_name: form.customer_name,
        plant_id: plantId || null,
        product_type_id: productTypeId,
        product_type_code: selectedProduct.code,
        input: buildInput(),
        status: 'draft',
      })
      setSavedNumber(saved.simulation_number)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">← Admin</Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-8 h-8 text-blue-600" />
              Prijscalculator
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Generieke component-engine — PALLET, kist en karton via product-templates.
            </p>
          </div>
          <Link
            href="/admin/pricing-simulations"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <History className="w-4 h-4" />
            Prijs simulaties
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {savedNumber && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Simulatie opgeslagen: <strong>{savedNumber}</strong>
          </div>
        )}

        {loadingMaster ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800">Invoer</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Plant</span>
                  <select
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Kies plant —</option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Producttype</span>
                  <select
                    value={productTypeId}
                    onChange={(e) => { setProductTypeId(e.target.value); setResult(null) }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Kies type —</option>
                    {productTypes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}){hasProductTemplate(p.code) ? '' : ' — binnenkort'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-gray-500">Klantnaam</span>
                <input
                  value={form.customer_name}
                  onChange={(e) => setField('customer_name', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Naam klant"
                />
              </label>

              {!hasCalculator && selectedProduct && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Calculator voor {selectedProduct.name} is nog niet beschikbaar.
                </p>
              )}

              {template && defaultWoodMaterials.length > 0 && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Standaard materiaal (hout)</span>
                  <select
                    value={form.default_material_id}
                    onChange={(e) => setField('default_material_id', e.target.value)}
                    disabled={loadingMaterials}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Optioneel —</option>
                    {defaultWoodMaterials.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.material_code})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Fallback voor componenten zonder eigen materiaalkeuze.
                  </p>
                </label>
              )}

              {template && (
                <ProductComponentsForm
                  template={template}
                  components={components}
                  onChange={(c) => { setComponents(c); setSavedNumber(null) }}
                  materialsByCategory={materialsByCategory}
                  defaultMaterialId={form.default_material_id}
                  disabled={!hasCalculator}
                />
              )}

              {template?.allowExtraLines && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-blue-900">Extra materialen</h3>
                    <button
                      type="button"
                      onClick={() => setExtraLines((prev) => [...prev, newExtraLine()])}
                      disabled={!hasCalculator}
                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Regel toevoegen
                    </button>
                  </div>
                  {extraLines.map((line) => (
                    <div key={line.key} className="flex flex-wrap gap-2 items-end">
                      <label className="flex-1 min-w-[140px]">
                        <span className="text-xs text-gray-500">Materiaal</span>
                        <select
                          value={line.material_id}
                          onChange={(e) => {
                            const v = e.target.value
                            setExtraLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, material_id: v } : l)))
                            setSavedNumber(null)
                          }}
                          disabled={!hasCalculator}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="">— Geen —</option>
                          {(materialsByCategory.extra ?? []).map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                          ))}
                        </select>
                      </label>
                      <label className="w-24">
                        <span className="text-xs text-gray-500">Hoev./stuk</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.quantity_per_unit}
                          onChange={(e) => {
                            const v = e.target.value
                            setExtraLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, quantity_per_unit: v } : l)))
                            setSavedNumber(null)
                          }}
                          disabled={!hasCalculator}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      {extraLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExtraLines((prev) => prev.filter((l) => l.key !== line.key))}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="Verwijder regel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['quantity', 'Aantal', '1'],
                  ['labor_minutes_per_unit', 'Arbeid min/stuk', '0.1'],
                  ['labor_cost_per_hour', 'Arbeidskost / uur (€)', '0.01'],
                  ['transport_cost', 'Transport (€)', '0.01'],
                  ['overhead_percentage', 'Overhead %', '0.1'],
                  ['margin_percentage', 'Marge %', '0.1'],
                ] as const).map(([key, label, step]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    <input
                      type="number"
                      step={step}
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={!hasCalculator}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void handleCalculate()}
                  disabled={calculating || !hasCalculator}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  Bereken prijs
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !result}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simulatie opslaan
                </button>
              </div>
            </div>

            <div>
              {result ? (
                <PricingResultCard result={result} />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
                  Vul componenten in en klik &quot;Bereken prijs&quot;.
                </div>
              )}
              {result && (
                <p className="mt-3 text-xs text-gray-400 text-center">
                  {result.meta?.wood_volume_m3_per_pallet != null && (
                    <>Volume: {result.meta.wood_volume_m3_per_pallet} m³/stuk · </>
                  )}
                  {formatEuro(result.pricePerUnit)} / stuk
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
