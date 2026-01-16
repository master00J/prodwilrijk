'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, Package, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function PackedTab() {
  const [packedData, setPackedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [packedXmlFile, setPackedXmlFile] = useState<File | null>(null)
  const [indusFileN, setIndusFileN] = useState<File | null>(null)
  const [indusFileY, setIndusFileY] = useState<File | null>(null)
  const [poNumbers, setPoNumbers] = useState({
    apf: 'MF-4536602',
    s4: 'MF-4536602',
    s5: 'MF-4536602',
    s9: 'MF-4536602',
    indus: 'MF-4581681',
  })
  const [indusSuffix, setIndusSuffix] = useState('KC')
  const [converting, setConverting] = useState(false)

  const loadPacked = useCallback(async () => {
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
  }, [dateFrom, dateTo])

  useEffect(() => {
    loadPacked()
  }, [loadPacked])

  const handleFileSelect = (file: File | null) => {
    if (file) {
      const fileName = file.name.toLowerCase()
      if (!fileName.includes('.xlsx') && !fileName.includes('.xls')) {
        alert('Ongeldig bestandstype. Verwacht: .xlsx of .xls')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleFileUpload = async (file: File) => {
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

        const packedRows = result.data.map((item: any) => ({
          case_label: item.case_label || '',
          case_type: item.case_type || '',
          packed_date: item.packed_date || new Date().toISOString().split('T')[0],
          packed_file: file.name,
        }))

        const saveResponse = await fetch('/api/grote-inpak/packed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packedData: packedRows }),
        })

        if (saveResponse.ok) {
          await loadPacked()
          setSelectedFile(null)
          alert('Packed data succesvol geüpload!')
        } else {
          throw new Error('Failed to save packed data')
        }
      } else {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload packed file')
      }
    } catch (error: any) {
      console.error('Error uploading packed file:', error)
      alert(`Error uploading packed file: ${error.message || 'Unknown error'}`)
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleFileSelect(file)
    }
  }, [])

  const handleExport = () => {
    const rows = packedData.map(item => ({
      'Case Label': item.case_label || '',
      'Case Type': item.case_type || '',
      'Packed Date': item.packed_date || '',
      'Packed File': item.packed_file || '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Packed')
    XLSX.writeFile(wb, `Packed_Overzicht_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleConvertPacked = async () => {
    if (!packedXmlFile) {
      alert('Selecteer eerst een PACKED Excel bestand')
      return
    }

    setConverting(true)
    try {
      const formData = new FormData()
      formData.append('file', packedXmlFile)
      formData.append('po_apf', poNumbers.apf)
      formData.append('po_s4', poNumbers.s4)
      formData.append('po_s5', poNumbers.s5)
      formData.append('po_s9', poNumbers.s9)

      const response = await fetch('/api/grote-inpak/packed-xml', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'XML export mislukt')
      }

      const result = await response.json()
      const files = result.files || []
      if (files.length === 0) {
        alert('Geen XML-bestanden aangemaakt')
        return
      }

      files.forEach((file: any) => {
        const blob = new Blob([file.xml], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.filename
        a.click()
        URL.revokeObjectURL(url)
      })

      alert('XML-bestanden aangemaakt en gedownload')
    } catch (error: any) {
      console.error('XML export error:', error)
      alert(`XML export mislukt: ${error.message || 'Unknown error'}`)
    } finally {
      setConverting(false)
    }
  }

  const handleConvertIndus = async () => {
    if (!indusFileN && !indusFileY) {
      alert('Selecteer minstens één PACKED_N of PACKED_Y bestand')
      return
    }

    setConverting(true)
    try {
      const formData = new FormData()
      if (indusFileN) formData.append('packed_n', indusFileN)
      if (indusFileY) formData.append('packed_y', indusFileY)
      formData.append('purchase_order', poNumbers.indus)
      formData.append('item_suffix', indusSuffix)

      const response = await fetch('/api/grote-inpak/packed-ny-xml', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'INDUS XML export mislukt')
      }

      const result = await response.json()
      const blob = new Blob([result.xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename || 'indus.xml'
      a.click()
      URL.revokeObjectURL(url)

      alert('INDUS XML aangemaakt en gedownload')
    } catch (error: any) {
      console.error('INDUS XML export error:', error)
      alert(`INDUS XML export mislukt: ${error.message || 'Unknown error'}`)
    } finally {
      setConverting(false)
    }
  }

  const filteredData = packedData.filter(item =>
    !searchQuery || item.case_label?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Packed Items</h2>
              <p className="text-sm text-slate-500">Beheer packed bestanden en XML-export</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={packedData.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-4 bg-white shadow-sm ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[1.02] shadow-md'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/30'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-colors ${
            dragActive ? 'bg-blue-100' : selectedFile ? 'bg-emerald-100' : 'bg-slate-100'
          }`}>
            <Upload className={`w-8 h-8 ${dragActive ? 'text-blue-600' : selectedFile ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Packed Excel Upload</h3>
          {selectedFile ? (
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">Geselecteerd bestand:</p>
              <p className="text-base font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg inline-block">
                {selectedFile.name}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              Sleep bestand hierheen of<br />
              <span className="text-slate-400">klik om te selecteren</span>
            </p>
          )}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="packed-upload"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />
          <div className="flex gap-3 justify-center">
            <label
              htmlFor="packed-upload"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-all shadow-sm hover:shadow-md font-medium"
            >
              {selectedFile ? 'Wijzig Bestand' : 'Selecteer Bestand'}
            </label>
            {selectedFile && (
              <button
                onClick={() => handleFileUpload(selectedFile)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Uploaden...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-4">Ondersteunde formaten: .xlsx, .xls</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Van Datum</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tot Datum</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Zoek case label"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-10">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Packed Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Packed File</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map((item) => (
              <tr key={`${item.case_label}-${item.packed_date}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{item.case_label}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.case_type || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.packed_date || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.packed_file || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">📤 Exporteer Packed → XML</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            value={poNumbers.apf}
            onChange={(e) => setPoNumbers({ ...poNumbers, apf: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PO voor APF/Leeg"
          />
          <input
            type="text"
            value={poNumbers.s4}
            onChange={(e) => setPoNumbers({ ...poNumbers, s4: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PO voor S4"
          />
          <input
            type="text"
            value={poNumbers.s5}
            onChange={(e) => setPoNumbers({ ...poNumbers, s5: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PO voor S5"
          />
          <input
            type="text"
            value={poNumbers.s9}
            onChange={(e) => setPoNumbers({ ...poNumbers, s9: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PO voor S9"
          />
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setPackedXmlFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={handleConvertPacked}
            disabled={converting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {converting ? 'Bezig...' : 'Exporteer Packed → XML'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">📤 Exporteer INDUS (PACKED_N/Y) → XML</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            value={poNumbers.indus}
            onChange={(e) => setPoNumbers({ ...poNumbers, indus: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PO voor INDUS"
          />
          <input
            type="text"
            value={indusSuffix}
            onChange={(e) => setIndusSuffix(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Item suffix indien nodig (bv. KC)"
          />
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setIndusFileN(e.target.files?.[0] || null)}
          />
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setIndusFileY(e.target.files?.[0] || null)}
          />
          <button
            onClick={handleConvertIndus}
            disabled={converting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {converting ? 'Bezig...' : 'Exporteer INDUS → XML'}
          </button>
        </div>
      </div>
    </div>
  )
}
