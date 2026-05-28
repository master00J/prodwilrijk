import { supabase } from '@/lib/supabase/client'
import type { PricingResult } from '@/lib/pricing-engine/types'

async function pricingFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return fetch(url, { ...options, headers })
}

export interface PricingMasterOption {
  id: string
  code: string
  name: string
}

export interface SimulationRow {
  id: string
  simulation_number: string
  customer_name: string | null
  status: string
  created_at: string
  input_data: Record<string, unknown>
  result_data: PricingResult
  pricing_plants?: { code: string; name: string } | null
  pricing_product_types?: { code: string; name: string } | null
}

export async function fetchProductTypes() {
  const res = await pricingFetch('/api/pricing/product-types')
  if (!res.ok) throw new Error((await res.json()).error ?? 'Laden mislukt')
  return res.json() as Promise<PricingMasterOption[]>
}

export async function fetchPlants() {
  const res = await pricingFetch('/api/pricing/plants')
  if (!res.ok) throw new Error((await res.json()).error ?? 'Laden mislukt')
  return res.json() as Promise<PricingMasterOption[]>
}

export async function calculatePriceApi(productTypeCode: string, input: Record<string, unknown>) {
  const res = await pricingFetch('/api/pricing/calculate', {
    method: 'POST',
    body: JSON.stringify({ product_type_code: productTypeCode, input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Berekening mislukt')
  return data.result as PricingResult
}

export async function saveSimulation(payload: Record<string, unknown>) {
  const res = await pricingFetch('/api/pricing/simulations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Opslaan mislukt')
  return data as SimulationRow
}

export async function fetchSimulations() {
  const res = await pricingFetch('/api/pricing/simulations')
  if (!res.ok) throw new Error((await res.json()).error ?? 'Laden mislukt')
  return res.json() as Promise<SimulationRow[]>
}

export async function fetchSimulation(id: string) {
  const res = await pricingFetch(`/api/pricing/simulations/${id}`)
  if (!res.ok) throw new Error((await res.json()).error ?? 'Laden mislukt')
  return res.json() as Promise<SimulationRow>
}

export function formatEuro(amount: number) {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount)
}
