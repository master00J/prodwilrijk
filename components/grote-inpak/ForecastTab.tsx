'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, TrendingUp } from 'lucide-react'

export default function ForecastTab() {
  const [forecastData, setForecastData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const loadForecast = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`/api/grote-inpak/forecast?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setForecastData(result.data || [])
      }
    } catch (error) {
      console.error('Error loading forecast:', error)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    loadForecast()
  }, [loadForecast])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', 'forecast')

      const uploadResponse = await fetch('/api/grote-inpak/upload', {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        const result = await uploadResponse.json()
        
        // Save to database
        const saveResponse = await fetch('/api/grote-inpak/forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forecastData: result.data }),
        })

        if (saveResponse.ok) {
          await loadForecast()
          alert('Forecast data successfully uploaded!')
        }
      }
    } catch (error) {
      console.error('Error uploading forecast:', error)
      alert('Error uploading forecast file')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const csv = [
      ['Item Number', 'Forecast Date', 'Forecast Quantity'],
      ...forecastData.map(item => [
        item.item_number || '',
        item.forecast_date || '',
        item.forecast_quantity || '0',
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forecast_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group by item number for summary
  const summary = forecastData.reduce((acc: any, item: any) => {
    const key = item.item_number || 'Unknown'
    if (!acc[key]) {
      acc[key] = { item_number: key, total: 0, dates: [] }
    }
    acc[key].total += parseInt(item.forecast_quantity || '0', 10)
    acc[key].dates.push(item.forecast_date)
    return acc
  }, {})

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📈 Forecast</h2>
        <div className="flex gap-2">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
              dragActive
                ? 'bg-blue-600 scale-105'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              if (e.dataTransfer.files?.[0]) {
                const file = e.dataTransfer.files[0]
                if (file.name.endsWith('.csv')) {
                  const event = { target: { files: [file] } } as any
                  handleFileUpload(event)
                }
              }
            }}
          >
            <Upload className="w-4 h-4" />
            <label className="cursor-pointer">
              {dragActive ? 'Drop hier!' : 'Upload Forecast'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {Object.keys(summary).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Forecast Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold">{Object.keys(summary).length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Forecast Quantity</p>
              <p className="text-2xl font-bold">
                {Object.values(summary).reduce((sum: number, item: any) => sum + item.total, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Forecast Dates</p>
              <p className="text-2xl font-bold">{forecastData.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : forecastData.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Forecast Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Forecast Quantity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {forecastData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.forecast_date ? new Date(item.forecast_date).toLocaleDateString('nl-NL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.forecast_quantity || '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Geen forecast data gevonden. Upload een forecast CSV bestand om te beginnen.
        </div>
      )}
    </div>
  )
}

