'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AdminGuard from '@/components/AdminGuard'
import PricingResultCard from '@/components/pricing/PricingResultCard'
import { fetchSimulation, type SimulationRow } from '@/lib/pricing/client'
import { Loader2 } from 'lucide-react'

export default function PricingSimulationDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [row, setRow] = useState<SimulationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchSimulation(id)
      .then(setRow)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link href="/admin/pricing-simulations" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Prijs simulaties
        </Link>

        {loading && (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {row && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{row.simulation_number}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {row.customer_name ?? 'Geen klant'} · {row.pricing_plants?.name ?? '—'} · {row.pricing_product_types?.name ?? '—'} ·{' '}
                <span className="capitalize">{row.status}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Aangemaakt: {new Date(row.created_at).toLocaleString('nl-BE')}
              </p>
            </div>

            <PricingResultCard result={row.result_data} />

            {row.result_data.meta?.components && row.result_data.meta.components.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <h2 className="font-semibold text-gray-800 mb-2 text-sm">Maatvoering onderdelen</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-1">Onderdeel</th>
                      <th className="py-1">Stuks</th>
                      <th className="py-1">m³/pallet</th>
                      <th className="py-1">Houtsoort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.result_data.meta.components.map((c) => (
                      <tr key={c.key} className="border-b border-amber-100/80">
                        <td className="py-1.5">{c.label}</td>
                        <td className="py-1.5">{c.count}</td>
                        <td className="py-1.5 tabular-nums">{c.volume_m3_per_pallet?.toFixed(4)}</td>
                        <td className="py-1.5">{c.wood_type ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {row.result_data.meta.wood_volume_m3_per_pallet != null && (
                  <p className="text-xs text-gray-600 mt-2">
                    Totaal hout: {row.result_data.meta.wood_volume_m3_per_pallet} m³/pallet
                    {row.result_data.meta.wood_volume_m3_total != null && (
                      <> · {row.result_data.meta.wood_volume_m3_total} m³ order</>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Invoerdata</h2>
              <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto max-h-64">
                {JSON.stringify(row.input_data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
