'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerHour: number
  revenue: number
}

interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerHour: number
  totalDays: number
  totalRevenue: number
}

interface PersonStats {
  name: string
  itemsPacked: number
  manHours: number
  itemsPerHour: number
}

interface DetailedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  price: number
  revenue: number
  date_packed: string
  date_added: string
}

export default function CNHPrepackMonitorPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [personStats, setPersonStats] = useState<PersonStats[]>([])
  const [detailedItems, setDetailedItems] = useState<DetailedItem[]>([])

  // Set default date range to last 7 days
  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    
    setDateTo(today.toISOString().split('T')[0])
    setDateFrom(lastWeek.toISOString().split('T')[0])
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      })
      
      const response = await fetch(`/api/admin/prepack-stats?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      
      const data = await response.json()
      setDailyStats(data.dailyStats || [])
      setTotals(data.totals || null)
      setPersonStats(data.personStats || [])
      setDetailedItems(data.detailedItems || [])
    } catch (error) {
      console.error('Error fetching stats:', error)
      alert('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link 
          href="/cnh/admin" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Terug naar CNH Admin
        </Link>
        <h1 className="text-3xl font-bold">Prepack Flow Monitoring</h1>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-6 flex gap-4 items-end">
          <div>
            <label className="block mb-2 font-medium">Vanaf Datum</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">Tot Datum</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={fetchStats}
            disabled={loading || !dateFrom || !dateTo}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Laden...' : 'Vernieuwen'}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Aantal Verpakte Kisten</div>
            <div className="text-3xl font-bold text-blue-600">
              {totals ? totals.totalItemsPacked : '-'}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
            <div className="text-sm text-gray-600 mb-1">Totale Manuren</div>
            <div className="text-3xl font-bold text-green-600">
              {totals ? totals.totalManHours.toFixed(2) : '-'}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
            <div className="text-sm text-gray-600 mb-1">Gemiddeld Items/Uur</div>
            <div className="text-3xl font-bold text-purple-600">
              {totals ? totals.averageItemsPerHour.toFixed(2) : '-'}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
            <div className="text-sm text-gray-600 mb-1">Totaal Dagen</div>
            <div className="text-3xl font-bold text-orange-600">
              {totals ? totals.totalDays : '-'}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">Totale Omzet</div>
            <div className="text-3xl font-bold text-yellow-600">
              {totals ? `€${totals.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Aantal Verpakte Kisten per Persoon */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Aantal Verpakte Kisten per Persoon</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : personStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Persoon</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aantal Verpakte Kisten</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/Uur</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {personStats
                  .sort((a, b) => b.itemsPacked - a.itemsPacked) // Sort by items packed descending
                  .map((stat) => (
                    <tr key={stat.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPacked}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPerHour.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Items List */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Gedetailleerde Lijst Verpakte Items</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Items laden...</div>
          </div>
        ) : detailedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen items gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Itemnummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">PO Nummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aantal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Prijs</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.date_packed).toLocaleDateString('nl-NL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.po_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.amount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.price > 0 ? `€${item.price.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.revenue > 0 ? `€${item.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Statistics Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Dagelijkse Statistieken</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medewerkers</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/Uur</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyStats.map((stat) => (
                  <tr key={stat.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(stat.date).toLocaleDateString('nl-NL', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.itemsPacked}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.employeeCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPerHour.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
