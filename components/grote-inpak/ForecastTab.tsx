'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Upload, Download, TrendingUp } from 'lucide-react'

export default function ForecastTab() {
  const [forecastData, setForecastData] = useState<any[]>([])
  const [forecastChanges, setForecastChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const shiftSummary = useMemo(() => {
    const byLabel = new Map<
      string,
      {
        case_label: string
        case_type: string
        total_shift_days: number
        change_count: number
        last_old_date: string | null
        last_new_date: string | null
        last_changed_at: string | null
      }
    >()
    forecastChanges.forEach((change: any) => {
      const label = String(change.case_label || '').trim()
      if (!label) return
      const oldDate = change.old_arrival_date ? new Date(change.old_arrival_date) : null
      const newDate = change.new_arrival_date ? new Date(change.new_arrival_date) : null
      const deltaDays =
        oldDate && newDate
          ? Math.round((newDate.getTime() - oldDate.getTime()) / 86400000)
          : 0
      const current = byLabel.get(label) || {
        case_label: label,
        case_type: String(change.case_type || '').trim(),
        total_shift_days: 0,
        change_count: 0,
        last_old_date: null,
        last_new_date: null,
        last_changed_at: null,
      }
      current.total_shift_days += deltaDays
      current.change_count += 1
      current.last_old_date = String(change.old_arrival_date || current.last_old_date || '')
      current.last_new_date = String(change.new_arrival_date || current.last_new_date || '')
      current.last_changed_at = String(change.changed_at || current.last_changed_at || '')
      if (!current.case_type && change.case_type) {
        current.case_type = String(change.case_type)
      }
      byLabel.set(label, current)
    })
    return Array.from(byLabel.values()).sort((a, b) => Math.abs(b.total_shift_days) - Math.abs(a.total_shift_days))
  }, [forecastChanges])

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

      const changesParams = new URLSearchParams()
      if (dateFrom) changesParams.append('date_from', dateFrom)
      if (dateTo) changesParams.append('date_to', dateTo)
      const changesResponse = await fetch(`/api/grote-inpak/forecast-changes?${changesParams.toString()}`)
      if (changesResponse.ok) {
        const changesResult = await changesResponse.json()
        setForecastChanges(changesResult.data || [])
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

  const handleFileSelect = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    const valid = list.filter((file) => file.name.toLowerCase().endsWith('.csv'))
    if (valid.length === 0) {
      alert('Ongeldig bestandstype. Verwacht: .csv')
      return
    }
    setSelectedFiles(valid)
  }

  const handleFileUpload = async (files: File[]) => {
    if (!files || files.length === 0) return

    setLoading(true)
    try {
      const allRows: any[] = []
      const errors: string[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileType', 'forecast')

        const uploadResponse = await fetch('/api/grote-inpak/upload', {
          method: 'POST',
          body: formData,
        })

        if (uploadResponse.ok) {
          const result = await uploadResponse.json()
          allRows.push(...(result.data || []))
        } else {
          const error = await uploadResponse.json()
          errors.push(`${file.name}: ${error.error || 'Upload mislukt'}`)
        }
      }

      if (allRows.length > 0) {
        const saveResponse = await fetch('/api/grote-inpak/forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forecastData: allRows, replace: true }),
        })

        if (!saveResponse.ok) {
          const error = await saveResponse.json()
          throw new Error(error.error || 'Failed to save forecast data')
        }
      }

      await loadForecast()
      setSelectedFiles([])

      if (errors.length > 0) {
        alert(`Sommige bestanden faalden:\n${errors.join('\n')}`)
      } else {
        alert('Forecast data succesvol geüpload!')
      }
    } catch (error: any) {
      console.error('Error uploading forecast:', error)
      alert(`Error uploading forecast file: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const isActive = e.type === 'dragenter' || e.type === 'dragover'
    setDragActive(isActive)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [])

  const downloadForecastMatrix = async (location: 'Genk' | 'Wilrijk') => {
    try {
      const response = await fetch('/api/grote-inpak/forecast-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export mislukt')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Forecast_${location}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Forecast export error:', error)
      alert(`Forecast export mislukt: ${error.message || 'Unknown error'}`)
    }
  }

  const filteredData = forecastData.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      String(item.case_label || '').toLowerCase().includes(query) ||
      String(item.case_type || '').toLowerCase().includes(query) ||
      String(item.source_file || '').toLowerCase().includes(query)
    )
  })

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">📈 Forecast</h2>
          <div className="flex gap-2">
            <button
              onClick={() => downloadForecastMatrix('Genk')}
              disabled={forecastData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Matrix Genk
            </button>
            <button
              onClick={() => downloadForecastMatrix('Wilrijk')}
              disabled={forecastData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Matrix Wilrijk
            </button>
          </div>
        </div>

        {/* Forecast File Upload with Drag and Drop */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50 scale-105'
              : selectedFiles.length > 0
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-blue-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className={`w-12 h-12 mx-auto mb-2 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="font-medium mb-1">Forecast CSV</p>
          {selectedFiles.length > 0 ? (
            <p className="text-sm text-gray-500 mb-3">
              <span className="text-green-700 font-semibold">
                {selectedFiles.length} bestand(en) geselecteerd
              </span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">
              Sleep bestand hierheen of<br />
              klik om te selecteren
            </p>
          )}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            id="forecast-upload"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <div className="flex gap-2 justify-center">
            <label
              htmlFor="forecast-upload"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
            >
              {selectedFiles.length > 0 ? 'Wijzig Bestanden' : 'Selecteer Bestanden'}
            </label>
            {selectedFiles.length > 0 && (
              <button
                onClick={() => handleFileUpload(selectedFiles)}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Uploaden...' : 'Upload'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Upload alle forecast CSV bestanden tegelijk (FOR1953 en FORESCO)
          </p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Zoek case, type, file"
            />
          </div>
        </div>
      </div>

      {forecastData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Forecast Overzicht
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Totaal Forecast</p>
              <p className="text-2xl font-bold">{forecastData.length}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Gefilterd</p>
              <p className="text-2xl font-bold">{filteredData.length}</p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Arrival Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Source File</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.case_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('nl-NL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.source_file || '-'}</td>
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

      <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
        <h3 className="text-lg font-semibold mb-4">📅 Forecast datumwijzigingen</h3>
        {forecastChanges.length === 0 ? (
          <p className="text-sm text-gray-500">Geen datumwijzigingen gevonden in deze periode.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Oude Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nieuwe Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bronbestand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Verschuiving</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Gewijzigd</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecastChanges.map((item: any, index: number) => (
                  <tr key={`${item.case_label}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.case_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.old_arrival_date ? new Date(item.old_arrival_date).toLocaleDateString('nl-NL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.new_arrival_date ? new Date(item.new_arrival_date).toLocaleDateString('nl-NL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.source_file || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.old_arrival_date && item.new_arrival_date
                        ? `${Math.round(
                            (new Date(item.new_arrival_date).getTime() - new Date(item.old_arrival_date).getTime()) /
                              86400000
                          )} dagen`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.changed_at ? new Date(item.changed_at).toLocaleString('nl-NL') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
        <h3 className="text-lg font-semibold mb-4">📌 Overzicht verschuivingen per case</h3>
        {shiftSummary.length === 0 ? (
          <p className="text-sm text-gray-500">Geen verschuivingen gevonden om te tonen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Totaal verschoven</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aantal wijzigingen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Laatste wijziging</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shiftSummary.map((item) => (
                  <tr key={item.case_label} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.case_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.total_shift_days === 0 ? '0 dagen' : `${item.total_shift_days} dagen`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.change_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.last_changed_at ? new Date(item.last_changed_at).toLocaleString('nl-NL') : '-'}
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

