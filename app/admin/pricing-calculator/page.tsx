'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'
import PricingResultCard from '@/components/pricing/PricingResultCard'
import type { PricingResult } from '@/lib/pricing-engine/types'
import {
  calculatePriceApi,
  fetchPlants,
  fetchProductTypes,
  formatEuro,
  saveSimulation,
  type PricingMasterOption,
} from '@/lib/pricing/client'
import { Calculator, History, Loader2 } from 'lucide-react'

const defaultForm = {
  customer_name: '',
  quantity: '100',
  length_mm: '1200',
  width_mm: '800',
  height_mm: '150',
  wood_volume_m3: '0.05',
  wood_cost_per_m3: '350',
  labor_minutes_per_unit: '12',
  labor_cost_per_hour: '45',
  extra_material_cost_per_unit: '2.5',
  transport_cost: '150',
  overhead_percentage: '8',
  margin_percentage: '15',
}

function toInput(form: typeof defaultForm) {
  return {
    quantity: Number(form.quantity),
    length_mm: Number(form.length_mm),
    width_mm: Number(form.width_mm),
    height_mm: Number(form.height_mm),
    wood_volume_m3: Number(form.wood_volume_m3),
    wood_cost_per_m3: Number(form.wood_cost_per_m3),
    labor_minutes_per_unit: Number(form.labor_minutes_per_unit),
    labor_cost_per_hour: Number(form.labor_cost_per_hour),
    extra_material_cost_per_unit: Number(form.extra_material_cost_per_unit),
    transport_cost: Number(form.transport_cost),
    overhead_percentage: Number(form.overhead_percentage),
    margin_percentage: Number(form.margin_percentage),
  }
}

export default function PricingCalculatorPage() {
  const [plants, setPlants] = useState<PricingMasterOption[]>([])
  const [productTypes, setProductTypes] = useState<PricingMasterOption[]>([])
  const [plantId, setPlantId] = useState('')
  const [productTypeId, setProductTypeId] = useState('')
  const [form, setForm] = useState(defaultForm)
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingResult | null>(null)
  const [savedNumber, setSavedNumber] = useState<string | null>(null)

  const selectedProduct = useMemo(
    () => productTypes.find((p) => p.id === productTypeId),
    [productTypes, productTypeId],
  )

  const isPallet = selectedProduct?.code === 'PALLET'

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

  const setField = (key: keyof typeof defaultForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSavedNumber(null)
  }

  const handleCalculate = useCallback(async () => {
    if (!selectedProduct) {
      setError('Kies een producttype')
      return
    }
    setCalculating(true)
    setError(null)
    setSavedNumber(null)
    try {
      const input = {
        ...toInput(form),
        customer_name: form.customer_name,
      }
      const res = await calculatePriceApi(selectedProduct.code, input)
      setResult(res)
    } catch (e: unknown) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Berekening mislukt')
    } finally {
      setCalculating(false)
    }
  }, [form, selectedProduct])

  const handleSave = async () => {
    if (!selectedProduct || !result) {
      setError('Bereken eerst een prijs voordat je opslaat')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = toInput(form)
      const saved = await saveSimulation({
        customer_name: form.customer_name,
        plant_id: plantId || null,
        product_type_id: productTypeId,
        product_type_code: selectedProduct.code,
        input,
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">← Admin</Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-8 h-8 text-blue-600" />
              Prijscalculator
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Server-side berekening op vaste regels — geen AI-prijzen. MVP: pallet.
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
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
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

              {!isPallet && selectedProduct && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Calculator voor {selectedProduct.name} is nog niet beschikbaar. Kies PALLET voor de MVP.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['quantity', 'Aantal', '1'],
                  ['length_mm', 'Lengte (mm)', '1'],
                  ['width_mm', 'Breedte (mm)', '1'],
                  ['height_mm', 'Hoogte (mm)', '1'],
                  ['wood_volume_m3', 'Houtvolume (m³)', '0.001'],
                  ['wood_cost_per_m3', 'Houtkost / m³ (€)', '0.01'],
                  ['labor_minutes_per_unit', 'Arbeid min/stuk', '0.1'],
                  ['labor_cost_per_hour', 'Arbeidskost / uur (€)', '0.01'],
                  ['extra_material_cost_per_unit', 'Extra mat./stuk (€)', '0.01'],
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
                      disabled={!isPallet}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void handleCalculate()}
                  disabled={calculating || !isPallet}
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
                  Vul de gegevens in en klik op &quot;Bereken prijs&quot;. De berekening gebeurt op de server.
                </div>
              )}
              {result && (
                <p className="mt-3 text-xs text-gray-400 text-center">
                  Preview: {formatEuro(result.pricePerUnit)} / stuk — definitieve prijs na opslaan via API
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
