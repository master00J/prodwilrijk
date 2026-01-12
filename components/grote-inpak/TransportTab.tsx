'use client'

import { useState, useMemo } from 'react'
import { Download, FileSpreadsheet, Search, Filter, Save } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { GroteInpakCase } from '@/types/database'

interface TransportTabProps {
  transport: any[]
  overview: GroteInpakCase[]
}

export default function TransportTab({ transport, overview }: TransportTabProps) {
  const [filterStatus, setFilterStatus] = useState<'Alle' | 'In Willebroek' | 'Niet in Willebroek'>('Alle')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [editedData, setEditedData] = useState<Map<string, Partial<GroteInpakCase>>>(new Map())
  const [isGenerating, setIsGenerating] = useState(false)

  // Merge transport with overview data
  const transportWithDetails = useMemo(() => {
    return transport.map((t) => {
      const caseData = overview.find(c => c.case_label === t.case_label)
      return {
        ...t,
        ...caseData,
        ...editedData.get(t.case_label),
      }
    })
  }, [transport, overview, editedData])

  // Apply filters
  const filteredTransport = useMemo(() => {
    let filtered = [...transportWithDetails]

    // Status filter
    if (filterStatus === 'In Willebroek') {
      filtered = filtered.filter(item => item.in_willebroek === true)
    } else if (filterStatus === 'Niet in Willebroek') {
      filtered = filtered.filter(item => item.in_willebroek === false)
    }

    // Date filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      filtered = filtered.filter(item => {
        if (!item.arrival_date) return false
        const arrival = new Date(item.arrival_date)
        return arrival >= fromDate
      })
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(item => {
        if (!item.arrival_date) return false
        const arrival = new Date(item.arrival_date)
        return arrival <= toDate
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.case_label?.toLowerCase().includes(query) ||
        item.case_type?.toLowerCase().includes(query) ||
        item.item_number?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [transportWithDetails, filterStatus, dateFrom, dateTo, searchQuery])

  // KPIs
  const totalGenk = transportWithDetails.length
  const inWillebroek = transportWithDetails.filter(item => item.in_willebroek).length
  const needTransport = totalGenk - inWillebroek
  const coverage = totalGenk > 0 ? (inWillebroek / totalGenk) * 100 : 0

  const handleFieldChange = (caseLabel: string, field: keyof GroteInpakCase, value: any) => {
    const newEdited = new Map(editedData)
    const existing = newEdited.get(caseLabel) || {}
    newEdited.set(caseLabel, { ...existing, [field]: value })
    setEditedData(newEdited)
  }

  const handleSave = async () => {
    try {
      const updates = Array.from(editedData.entries()).map(([case_label, updates]) => ({
        case_label,
        ...updates,
      }))

      const response = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        throw new Error('Error saving changes')
      }

      setEditedData(new Map())
      alert('Wijzigingen opgeslagen!')
      window.location.reload()
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  const handleGenerateTransportPlanning = async () => {
    setIsGenerating(true)
    try {
      // Fetch stock data
      const stockResponse = await fetch('/api/grote-inpak/stock')
      const stockResult = await stockResponse.ok ? await stockResponse.json() : { data: [] }
      
      const response = await fetch('/api/grote-inpak/transport-planning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transportData: filteredTransport,
          stockData: stockResult.data || [],
        }),
      })

      if (!response.ok) {
        throw new Error('Error generating transport planning')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Transportplanning_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      
      alert('Transport planning gegenereerd!')
    } catch (error) {
      console.error('Error generating transport planning:', error)
      alert('Error generating transport planning. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadExcel = () => {
    // Create Excel file from filtered data
    const data = filteredTransport.map(item => ({
      'Case Label': item.case_label,
      'Case Type': item.case_type,
      'Arrival Date': item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('nl-NL') : '',
      'Item Number': item.item_number,
      'Productielocatie': item.productielocatie,
      'In Willebroek': item.in_willebroek ? 'Ja' : 'Nee',
      'Stock Location': item.stock_location,
      'Status': item.status,
      'Comment': item.comment,
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transport')
    
    XLSX.writeFile(wb, `Transport_Genk_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Statistics
  const caseTypeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filteredTransport.forEach(item => {
      const type = item.case_type || 'Unknown'
      counts.set(type, (counts.get(type) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredTransport])

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filteredTransport.forEach(item => {
      const status = item.status || 'Geen status'
      counts.set(status, (counts.get(status) || 0) + 1)
    })
    return Array.from(counts.entries())
  }, [filteredTransport])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🚚 Transport Planning - Genk → Willebroek</h2>
      
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Totaal Genk Cases</p>
          <p className="text-2xl font-bold">{totalGenk}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Al in Willebroek</p>
          <p className="text-2xl font-bold">{inWillebroek}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Transport Nodig</p>
          <p className="text-2xl font-bold">{needTransport}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Coverage</p>
          <p className="text-2xl font-bold">{coverage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Alle">Alle</option>
              <option value="In Willebroek">In Willebroek</option>
              <option value="Niet in Willebroek">Niet in Willebroek</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Van Datum</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tot Datum</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Zoeken</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Case, type, item..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleSave}
          disabled={editedData.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          Opslaan Wijzigingen
        </button>
        <button
          onClick={handleGenerateTransportPlanning}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {isGenerating ? 'Genereren...' : 'Genereer Transport Planning'}
        </button>
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Transport Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Arrival Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">In WB</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stock Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Comment</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransport.map((item) => {
                const edited = editedData.get(item.case_label) || {}
                const displayItem = { ...item, ...edited }
                
                return (
                  <tr key={item.case_label} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{displayItem.case_label}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{displayItem.case_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayItem.arrival_date ? new Date(displayItem.arrival_date).toLocaleDateString('nl-NL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{displayItem.item_number || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={displayItem.in_willebroek || false}
                        onChange={(e) => handleFieldChange(item.case_label, 'in_willebroek', e.target.checked)}
                        className="w-5 h-5 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{displayItem.stock_location || '-'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={displayItem.status ?? ''}
                        onChange={(e) => handleFieldChange(item.case_label, 'status', e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-</option>
                        <option value="In productie">In productie</option>
                        <option value="Gereed">Gereed</option>
                        <option value="Verzonden">Verzonden</option>
                        <option value="In transit">In transit</option>
                        <option value="Ontvangen">Ontvangen</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={displayItem.comment || ''}
                        onChange={(e) => handleFieldChange(item.case_label, 'comment', e.target.value)}
                        placeholder="Add comment..."
                        className="text-sm w-full border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredTransport.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Geen transport cases gevonden met de huidige filters.
        </div>
      )}

      {/* Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Per Case Type</h3>
          <div className="space-y-1">
            {caseTypeCounts.slice(0, 10).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span>{type}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Per Status</h3>
          <div className="space-y-1">
            {statusCounts.map(([status, count]) => (
              <div key={status} className="flex justify-between text-sm">
                <span>{status}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Transport Nodig</h3>
          <p className="text-2xl font-bold mb-2">{needTransport}</p>
          <p className="text-sm text-gray-600">Te transporteren cases</p>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          💡 <strong>Tips:</strong> Filter op &apos;Niet in Willebroek&apos; om te zien wat getransporteerd moet worden.
          Gebruik &apos;Genereer Transport Planning&apos; voor een Excel met alle details voor de volgende werkdag.
        </p>
      </div>
    </div>
  )
}
