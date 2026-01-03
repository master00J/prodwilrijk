'use client'

import { useState, useEffect } from 'react'
import { Upload, Download, Calendar, Package } from 'lucide-react'

export default function PackedTab() {
  const [packedData, setPackedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadPacked()
  }, [dateFrom, dateTo])

  const loadPacked = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`/api/grote-inpak/packed?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setPackedData(result.data || [])
      }
    } catch (error) {
      console.error('Error loading packed items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', 'packed')

      const uploadResponse = await fetch('/api/grote-inpak/upload', {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        const result = await uploadResponse.json()
        
        // Transform data and save to database
        const packedData = result.data.map((item: any) => ({
          case_label: item.case_label || '',
          packed_date: item.packed_date || new Date().toISOString().split('T')[0],
          packed_file: file.name,
        }))

        const saveResponse = await fetch('/api/grote-inpak/packed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packedData }),
        })

        if (saveResponse.ok) {
          await loadPacked()
          alert('Packed data successfully uploaded!')
        }
      }
    } catch (error) {
      console.error('Error uploading packed file:', error)
      alert('Error uploading packed file')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const csv = [
      ['Case Label', 'Packed Date', 'Packed File'],
      ...packedData.map(item => [
        item.case_label || '',
        item.packed_date || '',
        item.packed_file || '',
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `packed_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredData = packedData.filter(item =>
    !searchQuery || item.case_label?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group by date for statistics
  const statsByDate = filteredData.reduce((acc: any, item: any) => {
    const date = item.packed_date || 'Unknown'
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📦 Packed Items</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Upload Packed File
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Case Label</label>
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
      {Object.keys(statsByDate).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Packing Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Packed Cases</p>
              <p className="text-2xl font-bold">{filteredData.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Unique Dates</p>
              <p className="text-2xl font-bold">{Object.keys(statsByDate).length}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Average per Day</p>
              <p className="text-2xl font-bold">
                {Object.keys(statsByDate).length > 0
                  ? Math.round(filteredData.length / Object.keys(statsByDate).length)
                  : 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredData.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Packed Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Packed File</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.packed_date ? new Date(item.packed_date).toLocaleDateString('nl-NL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.packed_file || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Geen packed items gevonden. Upload een packed Excel bestand om te beginnen.
        </div>
      )}
    </div>
  )
}

