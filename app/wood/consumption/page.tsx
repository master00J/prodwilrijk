'use client'

import { useState, useEffect } from 'react'
import { WoodConsumption } from '@/types/database'

export default function WoodConsumptionPage() {
  const [consumption, setConsumption] = useState<WoodConsumption[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [woodTypeFilter, setWoodTypeFilter] = useState('')

  const fetchConsumption = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDatum', startDate)
      if (endDate) params.append('eindDatum', endDate)
      if (woodTypeFilter) params.append('soort', woodTypeFilter)

      const response = await fetch(`/api/wood/consumption?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch consumption')
      const data = await response.json()
      setConsumption(data)
    } catch (error) {
      console.error('Error fetching consumption:', error)
      alert('Failed to load consumption data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConsumption()
  }, [])

  const handleApplyFilters = () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date')
      return
    }
    fetchConsumption()
  }

  const calculateVolume = (item: WoodConsumption) => {
    return (item.lengte / 1000) * (item.breedte / 1000) * (item.dikte / 1000) * item.aantal
  }

  const totalVolume = consumption.reduce((sum, item) => sum + calculateVolume(item), 0)
  const totalItems = consumption.reduce((sum, item) => sum + item.aantal, 0)

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Wood Consumption Overview</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block mb-2 font-medium">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">Wood Type:</label>
            <input
              type="text"
              value={woodTypeFilter}
              onChange={(e) => setWoodTypeFilter(e.target.value)}
              placeholder="Filter by wood type..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleApplyFilters}
              className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">Total Items Consumed</h3>
            <p className="text-2xl font-bold text-blue-600">{totalItems.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">Total Volume</h3>
            <p className="text-2xl font-bold text-green-600">{totalVolume.toFixed(3)} m³</p>
          </div>
        </div>
      </div>

      {/* Consumption Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Length (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Width (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Consumed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Volume (m³)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumption Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {consumption.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No consumption data found
                  </td>
                </tr>
              ) : (
                consumption.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.houtsoort}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.lengte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.breedte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dikte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.aantal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {calculateVolume(item).toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.datum_verbruik).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


