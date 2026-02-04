'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type KpiRow = { key: string; hours: number }

type OrderDetail = {
  order: { order_number: string; sales_order_number: string | null; uploaded_at: string }
  lines: Array<{
    item_number: string | null
    description: string | null
    quantity: number
    sales_price: number | null
    cost_per_item: number
    total_cost: number
  }>
  materials: Array<{
    item_number: string
    description: string | null
    usage_count: number
    price: number | null
    unit_of_measure: string
  }>
  totals: {
    line_count: number
    component_count: number
    total_material_cost: number
    missing_price_count: number
  }
}

export default function ProductionOrderKpiPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<KpiRow[]>([])
  const [steps, setSteps] = useState<KpiRow[]>([])
  const [employees, setEmployees] = useState<KpiRow[]>([])
  const [items, setItems] = useState<KpiRow[]>([])
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

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

  const loadOrderDetails = useCallback(async () => {
    setDetailsLoading(true)
    try {
      const response = await fetch('/api/production-order-time/order-details')
      if (!response.ok) throw new Error('Failed to fetch order details')
      const data = await response.json()
      setOrderDetails(data.orders || [])
    } catch (error) {
      console.error(error)
      alert('Orderdetails laden mislukt')
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKpi()
  }, [loadKpi])

  useEffect(() => {
    void loadOrderDetails()
  }, [loadOrderDetails])

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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {renderTable(orders, 'Uren per order')}
          {renderTable(steps, 'Uren per stap')}
          {renderTable(employees, 'Uren per medewerker')}
          {renderTable(items, 'Uren per item')}
        </div>

        {/* Orders met materiaalkosten */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Orders met materiaalkosten</h2>
            <button
              onClick={loadOrderDetails}
              disabled={detailsLoading}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-60"
            >
              {detailsLoading ? 'Laden...' : 'Vernieuwen'}
            </button>
          </div>

          {orderDetails.length === 0 ? (
            <div className="text-sm text-gray-500">Geen orders gevonden. Upload productieorders via Admin → Productieorder upload (tijd).</div>
          ) : (
            <div className="space-y-4">
              {orderDetails.map((od) => (
                <div key={od.order.order_number} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedOrder(expandedOrder === od.order.order_number ? null : od.order.order_number)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-medium">{od.order.order_number}</span>
                      {od.order.sales_order_number && (
                        <span className="text-sm text-gray-500">Verkoop: {od.order.sales_order_number}</span>
                      )}
                      <span className="text-sm text-gray-500">
                        {od.totals.line_count} lijnen · € {od.totals.total_material_cost.toFixed(2)} materiaalkost
                      </span>
                      {od.totals.missing_price_count > 0 && (
                        <span className="text-sm text-amber-600">
                          {od.totals.missing_price_count} ontbrekende prijs(en)
                        </span>
                      )}
                    </div>
                    <span className="text-gray-400">{expandedOrder === od.order.order_number ? '▼' : '▶'}</span>
                  </button>

                  {expandedOrder === od.order.order_number && (
                    <div className="p-4 border-t border-gray-200 space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Materiaalkost per lijn</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-2 pr-4">Item</th>
                                <th className="py-2 pr-4">Omschrijving</th>
                                <th className="py-2 pr-4">Aantal</th>
                                <th className="py-2 pr-4">Verkoopprijs</th>
                                <th className="py-2 pr-4">Kost/stuk</th>
                                <th className="py-2 pr-4">Totaal kost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {od.lines.map((line, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="py-2 pr-4 font-medium">{line.item_number || '-'}</td>
                                  <td className="py-2 pr-4">{line.description || '-'}</td>
                                  <td className="py-2 pr-4">{line.quantity}</td>
                                  <td className="py-2 pr-4">
                                    {line.sales_price != null ? `€ ${Number(line.sales_price).toFixed(2)}` : '-'}
                                  </td>
                                  <td className="py-2 pr-4">€ {Number(line.cost_per_item).toFixed(2)}</td>
                                  <td className="py-2 pr-4">€ {Number(line.total_cost).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-2">Grondstoffen</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-2 pr-4">Itemnummer</th>
                                <th className="py-2 pr-4">Omschrijving</th>
                                <th className="py-2 pr-4">Prijs</th>
                                <th className="py-2 pr-4">Eenheid</th>
                                <th className="py-2 pr-4">Gebruik</th>
                              </tr>
                            </thead>
                            <tbody>
                              {od.materials.map((m) => (
                                <tr key={m.item_number} className="border-t">
                                  <td className="py-2 pr-4 font-medium">{m.item_number}</td>
                                  <td className="py-2 pr-4">{m.description || '-'}</td>
                                  <td className="py-2 pr-4">
                                    {m.price !== null ? `€ ${Number(m.price).toFixed(4)}` : '-'}
                                  </td>
                                  <td className="py-2 pr-4">{m.unit_of_measure}</td>
                                  <td className="py-2 pr-4">{m.usage_count}x</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
