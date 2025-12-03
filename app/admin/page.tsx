'use client'

import { useState, useEffect } from 'react'
import AdminGuard from '@/components/AdminGuard'

interface DailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerHour: number
}

interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerHour: number
  totalDays: number
}

export default function AdminPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)

  // Set default date range to last 7 days
  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    
    setDateTo(today.toISOString().split('T')[0])
    setDateFrom(lastWeek.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchStats()
    }
  }, [dateFrom, dateTo])

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
    } catch (error) {
      console.error('Error fetching stats:', error)
      alert('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Prepack Flow Monitoring Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Prepack Flow Monitoring</h2>
        
        {/* Date Filters */}
        <div className="mb-6 flex gap-4 items-end">
          <div>
            <label className="block mb-2 font-medium">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">To Date</label>
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
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Totals Summary */}
        {totals && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Items Packed</div>
              <div className="text-2xl font-bold text-blue-600">{totals.totalItemsPacked}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Man Hours</div>
              <div className="text-2xl font-bold text-green-600">{totals.totalManHours.toFixed(2)}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Average Items/Hour</div>
              <div className="text-2xl font-bold text-purple-600">{totals.averageItemsPerHour.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Days</div>
              <div className="text-2xl font-bold text-orange-600">{totals.totalDays}</div>
            </div>
          </div>
        )}

        {/* Daily Statistics Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Loading statistics...</div>
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No data found for the selected date range
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items Packed</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Man Hours</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employees</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/Hour</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyStats.map((stat) => (
                  <tr key={stat.date}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(stat.date).toLocaleDateString('en-US', { 
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Future flows section - placeholder */}
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-600">Additional Flows</h2>
        <p className="text-gray-500">More monitoring flows will be added here in the future.</p>
      </div>
    </div>
    </AdminGuard>
  )
}

