'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, Calendar, Package, FileCode, RefreshCw } from 'lucide-react'

export default function PackedTab() {
  const [packedData, setPackedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [convertingToXML, setConvertingToXML] = useState(false)
  const [xmlConversionSettings, setXmlConversionSettings] = useState({
    division: 'AIF',
    vendorCode: '77774',
    deliveryDate: new Date().toISOString().split('T')[0],
  })
  const [dragActive, setDragActive] = useState(false)
  const [dragActiveXML, setDragActiveXML] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileForXML, setSelectedFileForXML] = useState<File | null>(null)

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
      // Validate file type - accept Excel files
      if (!fileName.includes('.xlsx') && !fileName.includes('.xls') && 
          !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
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
          setSelectedFile(null)
          alert('Packed data successfully uploaded!')
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

  const handleXMLFileSelect = (file: File | null) => {
    if (file) {
      const fileName = file.name.toLowerCase()
      // Validate file type - accept Excel files
      if (!fileName.includes('.xlsx') && !fileName.includes('.xls') && 
          !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        alert('Ongeldig bestandstype. Verwacht: .xlsx of .xls')
        return
      }
      setSelectedFileForXML(file)
    }
  }

  const handleXMLDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!convertingToXML) {
      const isActive = e.type === 'dragenter' || e.type === 'dragover'
      setDragActiveXML(isActive)
    }
  }, [convertingToXML])

  const handleXMLDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActiveXML(false)

    if (!convertingToXML && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleXMLFileSelect(file)
    }
  }, [convertingToXML])

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

  const handleConvertToXML = async (file: File) => {
    if (!file) return

    setConvertingToXML(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('division', xmlConversionSettings.division)
      formData.append('vendorCode', xmlConversionSettings.vendorCode)
      formData.append('deliveryDate', xmlConversionSettings.deliveryDate)

      const response = await fetch('/api/grote-inpak/convert-to-xml', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        
        // Download XML file
        const blob = new Blob([result.xml], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename || `packed_${xmlConversionSettings.deliveryDate}.xml`
        a.click()
        URL.revokeObjectURL(url)
        
        setSelectedFileForXML(null)
        alert(`Successfully converted ${result.count} items to XML!`)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to convert to XML')
      }
    } catch (error: any) {
      console.error('Error converting to XML:', error)
      alert(`Error converting file to XML: ${error.message || 'Unknown error'}`)
    } finally {
      setConvertingToXML(false)
    }
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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Packed Items</h2>
              <p className="text-sm text-slate-500">Manage and convert packed Excel files</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={packedData.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Packed File Upload with Drag and Drop - Modern Design */}
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
          <p className="text-xs text-slate-400 mt-4">
            Ondersteunde formaten: .xlsx, .xls
          </p>
        </div>

        {/* XML Conversion with Drag and Drop - Modern Design */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all bg-white shadow-sm ${
            dragActiveXML
              ? 'border-emerald-500 bg-emerald-50/50 scale-[1.02] shadow-md'
              : selectedFileForXML
              ? 'border-violet-400 bg-violet-50/30'
              : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/50'
          } ${convertingToXML ? 'opacity-60' : ''}`}
          onDragEnter={handleXMLDrag}
          onDragLeave={handleXMLDrag}
          onDragOver={handleXMLDrag}
          onDrop={handleXMLDrop}
        >
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-colors ${
            dragActiveXML ? 'bg-emerald-100' : selectedFileForXML ? 'bg-violet-100' : 'bg-slate-100'
          }`}>
            <FileCode className={`w-8 h-8 ${dragActiveXML ? 'text-emerald-600' : selectedFileForXML ? 'text-violet-600' : 'text-slate-400'}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">XML Conversion</h3>
          {selectedFileForXML ? (
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">Geselecteerd bestand:</p>
              <p className="text-base font-medium text-violet-700 bg-violet-50 px-4 py-2 rounded-lg inline-block">
                {selectedFileForXML.name}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              Sleep Excel bestand hierheen of<br />
              <span className="text-slate-400">klik om te selecteren voor XML conversie</span>
            </p>
          )}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="xml-upload"
            onChange={(e) => handleXMLFileSelect(e.target.files?.[0] || null)}
            disabled={convertingToXML}
          />
          <div className="flex gap-3 justify-center">
            <label
              htmlFor="xml-upload"
              className={`inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer transition-all shadow-sm hover:shadow-md font-medium ${convertingToXML ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {selectedFileForXML ? 'Wijzig Bestand' : 'Selecteer Bestand'}
            </label>
            {selectedFileForXML && (
              <button
                onClick={() => handleConvertToXML(selectedFileForXML)}
                disabled={convertingToXML}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
              >
                {convertingToXML ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <FileCode className="w-4 h-4" />
                    Convert to XML
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Converteer naar BE2NET_PO_INBOX XML formaat
          </p>
        </div>
      </div>

      {/* XML Conversion Settings - Modern Card Design */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileCode className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-800">XML Conversion Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Division</label>
            <input
              type="text"
              value={xmlConversionSettings.division}
              onChange={(e) => setXmlConversionSettings({ ...xmlConversionSettings, division: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              placeholder="AIF"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Code</label>
            <input
              type="text"
              value={xmlConversionSettings.vendorCode}
              onChange={(e) => setXmlConversionSettings({ ...xmlConversionSettings, vendorCode: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              placeholder="77774"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Date</label>
            <input
              type="date"
              value={xmlConversionSettings.deliveryDate}
              onChange={(e) => setXmlConversionSettings({ ...xmlConversionSettings, deliveryDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Tip:</span> Upload een packed Excel bestand en klik op &quot;Convert to XML&quot; om het te converteren naar BE2NET_PO_INBOX XML formaat.
          </p>
        </div>
      </div>

      {/* Filters - Modern Design */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
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

      {/* Statistics - Modern Card Design */}
      {Object.keys(statsByDate).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-800">
            <Package className="w-5 h-5 text-slate-600" />
            Packing Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-blue-700 mb-2">Total Packed Cases</p>
              <p className="text-3xl font-bold text-blue-900">{filteredData.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-emerald-700 mb-2">Unique Dates</p>
              <p className="text-3xl font-bold text-emerald-900">{Object.keys(statsByDate).length}</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-violet-700 mb-2">Average per Day</p>
              <p className="text-3xl font-bold text-violet-900">
                {Object.keys(statsByDate).length > 0
                  ? Math.round(filteredData.length / Object.keys(statsByDate).length)
                  : 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table - Modern Design */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
      ) : filteredData.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Case Label</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Packed Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Packed File</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.case_label || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.packed_date ? new Date(item.packed_date).toLocaleDateString('nl-NL') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.packed_file || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium mb-2">Geen packed items gevonden</p>
          <p className="text-sm text-slate-400">Upload een packed Excel bestand om te beginnen</p>
        </div>
      )}
    </div>
  )
}

