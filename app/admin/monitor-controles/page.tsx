'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Controle = {
  id: number
  product_naam: string
  order_nummer: string | null
  controle_datum: string
  uitgevoerd_door: string
  gecontroleerde_persoon: string
  afdeling: string | null
  status: string
  checklist_template_naam: string | null
  aantal_checklist_items: number
  aantal_fotos: number
}

type ControleDetail = {
  details: any
  checklist: any[]
  fotos: any[]
}

export default function MonitorControlesPage() {
  const [stats, setStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [controles, setControles] = useState<Controle[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<'7d' | '30d' | '3m'>('7d')
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    uitgevoerdDoor: '',
    gecontroleerdePersonn: '',
    afdeling: '',
    product: '',
    ordernummer: '',
  })
  const [selectedDetail, setSelectedDetail] = useState<ControleDetail | null>(null)

  const fetchStats = async () => {
    const response = await fetch('/api/product-inspectie/dashboard/stats')
    if (!response.ok) return
    const data = await response.json()
    setStats(data)
  }

  const fetchTrends = async () => {
    const response = await fetch(`/api/product-inspectie/dashboard/trends?period=${period}`)
    if (!response.ok) return
    const data = await response.json()
    setTrends(data || [])
  }

  const fetchControles = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/product-inspectie/controles')
      if (!response.ok) throw new Error('Failed to fetch controles')
      const data = await response.json()
      setControles(data || [])
    } catch (error) {
      console.error('Error fetching controles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchTrends()
    fetchControles()
  }, [])

  useEffect(() => {
    fetchTrends()
  }, [period])

  const filteredControles = useMemo(() => {
    return controles.filter((controle) => {
      if (filters.status && controle.status !== filters.status) return false
      if (filters.uitgevoerdDoor && !controle.uitgevoerd_door.toLowerCase().includes(filters.uitgevoerdDoor.toLowerCase()))
        return false
      if (
        filters.gecontroleerdePersonn &&
        !controle.gecontroleerde_persoon.toLowerCase().includes(filters.gecontroleerdePersonn.toLowerCase())
      )
        return false
      if (filters.afdeling && (controle.afdeling || '') !== filters.afdeling) return false
      if (filters.product && !controle.product_naam.toLowerCase().includes(filters.product.toLowerCase()))
        return false
      if (filters.ordernummer && !(controle.order_nummer || '').toLowerCase().includes(filters.ordernummer.toLowerCase()))
        return false
      if (filters.dateFrom && new Date(controle.controle_datum) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && new Date(controle.controle_datum) > new Date(filters.dateTo + 'T23:59:59')) return false
      return true
    })
  }, [controles, filters])

  const handleStatusUpdate = async (controleId: number, status: string) => {
    const response = await fetch(`/api/product-inspectie/controles/${controleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) return
    setControles((prev) =>
      prev.map((controle) => (controle.id === controleId ? { ...controle, status } : controle))
    )
    fetchStats()
    fetchTrends()
  }

  const handleDetail = async (controleId: number) => {
    const response = await fetch(`/api/product-inspectie/controles/${controleId}`)
    if (!response.ok) return
    const data = await response.json()
    setSelectedDetail(data)
  }

  const handleExport = () => {
    const params = new URLSearchParams(filters as any)
    window.open(`/api/product-inspectie/export/csv?${params.toString()}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Controle Dashboard & Monitor</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Controles vandaag</div>
            <div className="text-2xl font-semibold">{stats?.today ?? '-'}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-500">In behandeling</div>
            <div className="text-2xl font-semibold">{stats?.statusBreakdown?.['in behandeling'] ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Goedgekeurd</div>
            <div className="text-2xl font-semibold">{stats?.statusBreakdown?.goedgekeurd ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Afgekeurd</div>
            <div className="text-2xl font-semibold">{stats?.statusBreakdown?.afgekeurd ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Controles trend</h2>
            <div className="flex gap-2">
              {(['7d', '30d', '3m'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    period === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_controles" stroke="#2563eb" name="Totaal" />
                <Line type="monotone" dataKey="goedgekeurd" stroke="#10b981" name="Goedgekeurd" />
                <Line type="monotone" dataKey="afgekeurd" stroke="#ef4444" name="Afgekeurd" />
                <Line type="monotone" dataKey="in_behandeling" stroke="#f59e0b" name="In behandeling" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Alle statussen</option>
              <option value="in behandeling">In behandeling</option>
              <option value="goedgekeurd">Goedgekeurd</option>
              <option value="afgekeurd">Afgekeurd</option>
            </select>
            <input
              type="text"
              placeholder="Uitgevoerd door"
              value={filters.uitgevoerdDoor}
              onChange={(e) => setFilters({ ...filters, uitgevoerdDoor: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Gecontroleerde persoon"
              value={filters.gecontroleerdePersonn}
              onChange={(e) => setFilters({ ...filters, gecontroleerdePersonn: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Afdeling"
              value={filters.afdeling}
              onChange={(e) => setFilters({ ...filters, afdeling: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Product"
              value={filters.product}
              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Ordernummer"
              value={filters.ordernummer}
              onChange={(e) => setFilters({ ...filters, ordernummer: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              Totaal: {controles.length} | Gefilterd: {filteredControles.length}
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Export CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Laden...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Order</th>
                    <th className="px-3 py-2 text-left">Datum</th>
                    <th className="px-3 py-2 text-left">Uitgevoerd door</th>
                    <th className="px-3 py-2 text-left">Gecontroleerde</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Template</th>
                    <th className="px-3 py-2 text-left">Items</th>
                    <th className="px-3 py-2 text-left">Foto&apos;s</th>
                    <th className="px-3 py-2 text-left">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControles.map((controle) => (
                    <tr key={controle.id} className="border-b">
                      <td className="px-3 py-2">{controle.id}</td>
                      <td className="px-3 py-2">{controle.product_naam}</td>
                      <td className="px-3 py-2">{controle.order_nummer || '-'}</td>
                      <td className="px-3 py-2">
                        {new Date(controle.controle_datum).toLocaleString('nl-NL')}
                      </td>
                      <td className="px-3 py-2">{controle.uitgevoerd_door}</td>
                      <td className="px-3 py-2">{controle.gecontroleerde_persoon}</td>
                      <td className="px-3 py-2">
                        <select
                          value={controle.status}
                          onChange={(e) => handleStatusUpdate(controle.id, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="in behandeling">In behandeling</option>
                          <option value="goedgekeurd">Goedgekeurd</option>
                          <option value="afgekeurd">Afgekeurd</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">{controle.checklist_template_naam || 'Ad-hoc'}</td>
                      <td className="px-3 py-2">{controle.aantal_checklist_items}</td>
                      <td className="px-3 py-2">{controle.aantal_fotos}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleDetail(controle.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Bekijk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold">Controle #{selectedDetail.details.id}</h2>
              <button onClick={() => setSelectedDetail(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500">Product</div>
                <div className="font-medium">{selectedDetail.details.product_naam}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium">{selectedDetail.details.status}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500">Uitgevoerd door</div>
                <div className="font-medium">{selectedDetail.details.uitgevoerd_door}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500">Gecontroleerde persoon</div>
                <div className="font-medium">{selectedDetail.details.gecontroleerde_persoon}</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">Checklist</h3>
              <div className="space-y-2">
                {selectedDetail.checklist.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="font-medium">{item.item_beschrijving}</div>
                    <div className="text-sm text-gray-600">Antwoord: {item.antwoord_waarde || '-'}</div>
                    {item.opmerking_bij_antwoord && (
                      <div className="text-sm text-gray-500 mt-1">Opmerking: {item.opmerking_bij_antwoord}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedDetail.fotos.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Foto&apos;s</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedDetail.fotos.map((foto: any) => (
                    <img key={foto.id} src={foto.image_url || '#'} alt="Foto" className="w-full h-32 object-cover rounded-lg" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
