'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, Warehouse, TrendingUp } from 'lucide-react'

export default function StockAnalysisTab() {
  const [stockData, setStockData] = useState<any[]>([])
  const [aggregatedData, setAggregatedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [locationFilter, setLocationFilter] = useState('Alle')
  const [searchQuery, setSearchQuery] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const loadStock = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationFilter !== 'Alle') {
        params.append('location', locationFilter)
      }

      const response = await fetch(`/api/grote-inpak/stock?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setStockData(result.data || [])
        setAggregatedData(result.aggregated || [])
      }
    } catch (error) {
      console.error('Error loading stock:', error)
    } finally {
      setLoading(false)
    }
  }, [locationFilter])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setLoading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })
      formData.append('fileType', 'stock')

      const uploadResponse = await fetch('/api/grote-inpak/upload-multiple', {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        const result = await uploadResponse.json()
        
        // Stock files are now saved directly to database by upload-multiple route
        // Just reload the stock data
        await loadStock()
        alert(`Successfully uploaded ${result.filesProcessed || files.length} stock file(s)! ${result.count || 0} items processed.`)
      } else {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload stock files')
      }
    } catch (error: any) {
      console.error('Error uploading stock files:', error)
      alert(`Error uploading stock files: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const csv = [
      ['Kistnummer', 'ERP Code', 'Location', 'Quantity'],
      ...aggregatedData.flatMap(item => 
        item.locations?.map((loc: any) => [
          item.kistnummer || '',
          item.erp_code || '',
          loc.location || '',
          loc.quantity || '0',
        ]) || []
      ),
    ].map(row => row.map((cell: string) => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const locations = Array.from(new Set(stockData.map(item => item.location).filter(Boolean))).sort()

  const filteredAggregated = aggregatedData.filter(item =>
    !searchQuery || 
    item.kistnummer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.erp_code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalQuantity = filteredAggregated.reduce((sum, item) => sum + (item.total_quantity || 0), 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📊 Stock</h2>
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
                if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                  const event = { target: { files: [file] } } as any
                  handleFileUpload(event)
                }
              }
            }}
          >
            <Upload className="w-4 h-4" />
            <label className="cursor-pointer">
              {dragActive ? 'Drop hier!' : 'Upload Stock File'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                id="stock-upload"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Alle">Alle</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Kistnummer/ERP Code</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Stock Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold">{filteredAggregated.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Quantity</p>
            <p className="text-2xl font-bold">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Locations</p>
            <p className="text-2xl font-bold">{locations.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Stock Records</p>
            <p className="text-2xl font-bold">{stockData.length}</p>
          </div>
        </div>
      </div>

      {/* Aggregated Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredAggregated.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Kistnummer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">ERP Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stock per Locatie</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAggregated.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.kistnummer ? (
                      <span className="font-bold text-blue-600">{item.kistnummer}</span>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.erp_code || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.total_quantity || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {item.locations?.map((loc: any, i: number) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {loc.location}: {loc.quantity}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Geen stock data gevonden. Upload een stock bestand om te beginnen.
        </div>
      )}
    </div>
  )
}

