'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'
import { fetchSimulations, formatEuro, type SimulationRow } from '@/lib/pricing/client'
import { Calculator, Eye, History, Loader2 } from 'lucide-react'

export default function PricingSimulationsPage() {
  const [rows, setRows] = useState<SimulationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSimulations()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">← Admin</Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-8 h-8 text-indigo-600" />
              Prijs simulaties
            </h1>
            <p className="text-gray-500 text-sm mt-1">Historiek van opgeslagen prijscalculaties</p>
          </div>
          <Link
            href="/admin/pricing-calculator"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Calculator className="w-4 h-4" />
            Nieuwe simulatie
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 rounded-xl border border-dashed border-gray-200">
            Nog geen simulaties opgeslagen.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Nummer</th>
                  <th className="px-4 py-3 text-left">Klant</th>
                  <th className="px-4 py-3 text-left">Plant</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Aantal</th>
                  <th className="px-4 py-3 text-right">Totaal</th>
                  <th className="px-4 py-3 text-right">Per stuk</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const qty = Number(row.input_data?.quantity ?? 0)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString('nl-BE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.simulation_number}</td>
                      <td className="px-4 py-3">{row.customer_name ?? '—'}</td>
                      <td className="px-4 py-3">{row.pricing_plants?.name ?? '—'}</td>
                      <td className="px-4 py-3">{row.pricing_product_types?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{qty || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatEuro(row.result_data.salesPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatEuro(row.result_data.pricePerUnit)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/pricing-simulations/${row.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
