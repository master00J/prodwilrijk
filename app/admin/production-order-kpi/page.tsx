'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type KpiRow = { key: string; hours: number }

export default function ProductionOrderKpiPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<KpiRow[]>([])
  const [steps, setSteps] = useState<KpiRow[]>([])
  const [employees, setEmployees] = useState<KpiRow[]>([])
  const [items, setItems] = useState<KpiRow[]>([])

  const loadKpi = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      const response = await fetch(`/api/production-order-time/kpi?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch KPI')
      const data = await response.json()
      setOrders(data.orders || [])
      setSteps(data.steps || [])
      setEmployees(data.employees || [])
      setItems(data.items || [])
    } catch (error) {
      console.error(error)
      alert('KPI laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    void loadKpi()
  }, [loadKpi])

  const renderTable = (rows: KpiRow[], label: string) => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{label}</h2>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">Geen data.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Naam</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Uren</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{row.key}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.hours.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Productie Orders - KPI</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vanaf</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tot</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <button
                onClick={loadKpi}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Laden...' : 'Vernieuwen'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderTable(orders, 'Uren per order')}
          {renderTable(steps, 'Uren per stap')}
          {renderTable(employees, 'Uren per medewerker')}
          {renderTable(items, 'Uren per item')}
        </div>
      </div>
    </AdminGuard>
  )
}
