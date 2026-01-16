'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Database, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import OverviewTab from '@/components/grote-inpak/OverviewTab'
import TransportTab from '@/components/grote-inpak/TransportTab'
import ForecastTab from '@/components/grote-inpak/ForecastTab'
import PackedTab from '@/components/grote-inpak/PackedTab'
import StockAnalysisTab from '@/components/grote-inpak/StockAnalysisTab'
import BacklogTab from '@/components/grote-inpak/BacklogTab'
import ErpLinkTab from '@/components/grote-inpak/ErpLinkTab'
import ExecutiveDashboardTab from '@/components/grote-inpak/ExecutiveDashboardTab'
import KanbanTab from '@/components/grote-inpak/KanbanTab'

export default function GroteInpakPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [pilsFile, setPilsFile] = useState<File | null>(null)
  const [erpLinkFile, setErpLinkFile] = useState<File | null>(null)
  const [stockFiles, setStockFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<any[]>([])
  const [transportData, setTransportData] = useState<any[]>([])
  const [dragActivePils, setDragActivePils] = useState(false)
  const [dragActiveErpLink, setDragActiveErpLink] = useState(false)
  const [dragActiveStock, setDragActiveStock] = useState(false)
  const [uploadSectionExpanded, setUploadSectionExpanded] = useState(false)
  const pilsInputRef = useRef<HTMLInputElement>(null)
  const erpLinkInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)

  const tabs = [
    { id: 0, label: '📊 Executive Dashboard', icon: '📊' },
    { id: 1, label: '📋 Overzicht', icon: '📋' },
    { id: 2, label: '🚚 Transport', icon: '🚚' },
    { id: 3, label: '📈 Forecast', icon: '📈' },
    { id: 4, label: '📦 Packed', icon: '📦' },
    { id: 5, label: '📊 Stock', icon: '📊' },
    { id: 6, label: '📦 Kanban Rekken', icon: '📦' },
    { id: 7, label: '⏰ Backlog', icon: '⏰' },
    { id: 8, label: '🔗 ERP LINK', icon: '🔗' },
  ]

  const handleFileSelect = useCallback((type: 'pils' | 'erplink', file: File | null) => {
    if (type === 'pils') {
      setPilsFile(file)
    } else if (type === 'erplink') {
      setErpLinkFile(file)
    }
    setError(null)
  }, [])

  const handleStockFilesSelect = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files)
      // Validate file types
      const validFiles = fileArray.filter(file => {
        const fileName = file.name.toLowerCase()
        return fileName.includes('.xlsx') || fileName.includes('.xls') || 
               fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
               file.type.includes('spreadsheet') || file.type.includes('excel') || 
               file.type === '' || !file.type
      })
      
      if (validFiles.length !== fileArray.length) {
        setError('Sommige bestanden zijn geen Excel bestanden (.xlsx of .xls)')
      }
      
      setStockFiles(validFiles)
      setError(null)
    }
  }

  const handleStockDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const isActive = e.type === 'dragenter' || e.type === 'dragover'
    setDragActiveStock(isActive)
  }, [])

  const handleStockDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActiveStock(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files)
      // Validate file types
      const validFiles = fileArray.filter(file => {
        const fileName = file.name.toLowerCase()
        return fileName.includes('.xlsx') || fileName.includes('.xls') || 
               fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
               file.type.includes('spreadsheet') || file.type.includes('excel') || 
               file.type === '' || !file.type
      })
      
      if (validFiles.length !== fileArray.length) {
        setError('Sommige bestanden zijn geen Excel bestanden (.xlsx of .xls)')
      }
      
      setStockFiles(validFiles)
      setError(null)
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent, type: 'pils' | 'erplink') => {
    e.preventDefault()
    e.stopPropagation()
    const isActive = e.type === 'dragenter' || e.type === 'dragover'
    if (type === 'pils') {
      setDragActivePils(isActive)
    } else if (type === 'erplink') {
      setDragActiveErpLink(isActive)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, type: 'pils' | 'erplink') => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'pils') {
      setDragActivePils(false)
    } else if (type === 'erplink') {
      setDragActiveErpLink(false)
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const fileName = file.name.toLowerCase()
      
      if (type === 'pils') {
        // More flexible file type checking - accept files with .csv/.CSV in name
        const isValidType = fileName.includes('.csv') || fileName.endsWith('.csv')
        
        // Also check MIME type as fallback (empty type is common for dragged files)
        const isValidMimeType = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '' || !file.type
        
        if (isValidType || isValidMimeType) {
          handleFileSelect(type, file)
        } else {
          setError(`Ongeldig bestandstype. Verwacht: .csv. Bestand: ${file.name}`)
        }
      } else if (type === 'erplink') {
        // Validate Excel files for ERP LINK
        const isValidType = fileName.includes('.xlsx') || fileName.includes('.xls') || 
                           fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
        const isValidMimeType = file.type.includes('spreadsheet') || file.type.includes('excel') || 
                               file.type === '' || !file.type
        
        if (isValidType || isValidMimeType) {
          handleFileSelect(type, file)
        } else {
          setError(`Ongeldig bestandstype. Verwacht: .xlsx of .xls. Bestand: ${file.name}`)
        }
      }
    }
  }, [handleFileSelect])

  const handleProcess = async () => {
    // Allow processing if at least one file type is uploaded
    if (!pilsFile && stockFiles.length === 0 && !erpLinkFile) {
      setError('Upload ten minste één bestand (PILS, Stock, of ERP LINK)')
      return
    }

    setIsProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      let pilsResult: any = null
      let pilsUploaded = false
      
      // Upload PILS CSV if provided
      if (pilsFile) {
        const pilsFormData = new FormData()
        pilsFormData.append('file', pilsFile)
        pilsFormData.append('fileType', 'pils')

        const pilsResponse = await fetch('/api/grote-inpak/upload', {
          method: 'POST',
          body: pilsFormData,
        })

        if (!pilsResponse.ok) {
          const pilsError = await pilsResponse.json()
          throw new Error(pilsError.error || 'Error uploading PILS file')
        }

        pilsResult = await pilsResponse.json()
        pilsUploaded = true
      }

      // Upload ERP LINK file if provided
      let erpData: any[] = []
      let erpUploaded = false
      if (erpLinkFile) {
        const erpFormData = new FormData()
        erpFormData.append('file', erpLinkFile)
        erpFormData.append('fileType', 'erp')

        const erpResponse = await fetch('/api/grote-inpak/upload', {
          method: 'POST',
          body: erpFormData,
        })

        if (erpResponse.ok) {
          const erpResult = await erpResponse.json()
          erpData = erpResult.data || []
          erpUploaded = true
        }
      }

      // Upload stock files if provided - upload one by one to avoid 413 errors
      // Each file will overwrite stock for its specific location
      let stockUploaded = 0
      let stockItemsProcessed = 0
      if (stockFiles.length > 0) {
        for (const file of stockFiles) {
          const stockFormData = new FormData()
          stockFormData.append('files', file)
          stockFormData.append('fileType', 'stock')

          const stockResponse = await fetch('/api/grote-inpak/upload-multiple', {
            method: 'POST',
            body: stockFormData,
          })

          if (!stockResponse.ok) {
            // Try to parse error, but handle non-JSON responses
            let errorMessage = `Error uploading stock file: ${file.name}`
            try {
              const stockError = await stockResponse.json()
              errorMessage = stockError.error || errorMessage
            } catch {
              // If response is not JSON (e.g., HTML error page), use status text
              errorMessage = `Error uploading ${file.name}: ${stockResponse.status} ${stockResponse.statusText}`
            }
            throw new Error(errorMessage)
          }

          const stockResult = await stockResponse.json()
          stockUploaded++
          stockItemsProcessed += stockResult.count || 0
        }
      }

      // Load stock data from database for processing
      let stockData: any[] = []
      try {
        const stockDbResponse = await fetch('/api/grote-inpak/stock')
        if (stockDbResponse.ok) {
          const stockDbResult = await stockDbResponse.json()
          stockData = stockDbResult.data || []
        }
      } catch (err) {
        console.warn('Could not load stock data from database:', err)
      }

      // Process data (only if we have PILS data, otherwise just update stock)
      if (pilsResult && pilsResult.data) {
        const processResponse = await fetch('/api/grote-inpak/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pilsData: pilsResult.data,
            erpData: erpData,
            stockData: stockData,
          }),
        })

        if (!processResponse.ok) {
          let errorMessage = 'Error processing data'
          try {
            const processError = await processResponse.json()
            errorMessage = processError.error || errorMessage
          } catch {
            // If response is not JSON (e.g., HTML error page), use status text
            errorMessage = `Error processing data: ${processResponse.status} ${processResponse.statusText}`
          }
          throw new Error(errorMessage)
        }

        const processResult = await processResponse.json()
        setOverviewData(processResult.cases || [])
        setTransportData(processResult.transport || [])
        setDataLoaded(true)

        // Build success message
        const successParts: string[] = []
        if (pilsUploaded) {
          const pilsCount = pilsResult?.data?.length || 0
          successParts.push(`PILS: ${pilsCount} items verwerkt`)
        }
        if (erpUploaded) {
          const erpCount = erpData.length || 0
          successParts.push(`ERP LINK: ${erpCount} items toegevoegd`)
        }
        if (stockUploaded > 0) {
          successParts.push(`Stock: ${stockUploaded} bestand(en), ${stockItemsProcessed} items verwerkt`)
        }
        if (successParts.length > 0) {
          setSuccess(`✅ Bestanden succesvol verwerkt! ${successParts.join(' | ')}`)
          setTimeout(() => setSuccess(null), 5000)
        }
      } else if (stockFiles.length > 0) {
        // If only stock files are uploaded, just refresh the stock tab
        // The stock data is already saved to the database
        setDataLoaded(true)
        setSuccess(`✅ Stock bestanden succesvol geüpload! ${stockUploaded} bestand(en), ${stockItemsProcessed} items verwerkt.`)
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch (err: any) {
      console.error('Process error:', err)
      setError(err.message || 'Error processing files')
    } finally {
      setIsProcessing(false)
    }
  }

  const loadDataFromDatabase = useCallback(async () => {
    try {
      // Load cases from database
      const casesResponse = await fetch('/api/grote-inpak/cases')
      if (casesResponse.ok) {
        const casesResult = await casesResponse.json()
        const cases = casesResult.data || []
        setOverviewData(cases)
        
        // If we have cases, also load transport and mark as loaded
        if (cases.length > 0) {
          const transportResponse = await fetch('/api/grote-inpak/transport')
          if (transportResponse.ok) {
            const transportResult = await transportResponse.json()
            setTransportData(transportResult.data || [])
          }
          setDataLoaded(true)
        }
      }
    } catch (error) {
      console.error('Error loading data from database:', error)
    }
  }, [])

  useEffect(() => {
    // Load data from database when page loads
    loadDataFromDatabase()
  }, [loadDataFromDatabase])

  const handleRefresh = async () => {
    setDataLoaded(false)
    setOverviewData([])
    setTransportData([])
    setPilsFile(null)
    setErpLinkFile(null)
    setStockFiles([])
    setError(null)
    // Reload from database
    await loadDataFromDatabase()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🏭 Atlas Copco – Grote Inpak
        </h1>
        <p className="text-gray-600">
          Overzicht en Transportbeheer voor grote inpak workflow
        </p>
      </div>

      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div 
          className="flex items-center justify-between cursor-pointer mb-4 hover:bg-gray-50 -m-2 p-2 rounded transition-colors"
          onClick={() => setUploadSectionExpanded(!uploadSectionExpanded)}
        >
          <h2 className="text-2xl font-semibold">📁 Bestanden Uploaden</h2>
          {uploadSectionExpanded ? (
            <ChevronUp className="w-6 h-6 text-gray-500" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-500" />
          )}
        </div>
        
        {uploadSectionExpanded && (
          <div>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            <div className="mb-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActivePils
                ? 'border-blue-500 bg-blue-50 scale-105'
                : pilsFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragEnter={(e) => handleDrag(e, 'pils')}
            onDragLeave={(e) => handleDrag(e, 'pils')}
            onDragOver={(e) => handleDrag(e, 'pils')}
            onDrop={(e) => handleDrop(e, 'pils')}
          >
            <Upload className={`w-12 h-12 mx-auto mb-2 ${dragActivePils ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="font-medium mb-1">PILS CSV</p>
            <p className="text-sm text-gray-500 mb-3">
              {pilsFile ? (
                <span className="text-green-700 font-semibold">{pilsFile.name}</span>
              ) : (
                <>
                  Sleep bestand hierheen of<br />
                  klik om te selecteren
                </>
              )}
            </p>
            <input
              ref={pilsInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              id="pils-upload"
              onChange={(e) => handleFileSelect('pils', e.target.files?.[0] || null)}
            />
            <label
              htmlFor="pils-upload"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
            >
              {pilsFile ? 'Wijzig Bestand' : 'Selecteer Bestand'}
            </label>
          </div>
        </div>

        {/* ERP LINK Upload */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🔗 ERP LINK Excel (Optioneel - Productielocatie)
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActiveErpLink
                ? 'border-purple-500 bg-purple-50 scale-105'
                : erpLinkFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragEnter={(e) => handleDrag(e, 'erplink')}
            onDragLeave={(e) => handleDrag(e, 'erplink')}
            onDragOver={(e) => handleDrag(e, 'erplink')}
            onDrop={(e) => handleDrop(e, 'erplink')}
          >
            <Upload className={`w-12 h-12 mx-auto mb-2 ${dragActiveErpLink ? 'text-purple-500' : 'text-gray-400'}`} />
            <p className="font-medium mb-1">ERP LINK Excel</p>
            {erpLinkFile ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Geselecteerd bestand:</p>
                <p className="text-sm text-green-700 font-semibold">{erpLinkFile.name}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Sleep bestand hierheen of<br />
                klik om te selecteren
              </p>
            )}
            <input
              ref={erpLinkInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="erplink-upload"
              onChange={(e) => handleFileSelect('erplink', e.target.files?.[0] || null)}
            />
            <label
              htmlFor="erplink-upload"
              className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 cursor-pointer transition-colors"
            >
              {erpLinkFile ? 'Wijzig Bestand' : 'Selecteer Bestand'}
            </label>
            {erpLinkFile && (
              <button
                onClick={() => handleFileSelect('erplink', null)}
                className="ml-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Verwijder
              </button>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Upload ERP LINK Excel bestand om productielocatie te bepalen
            </p>
          </div>
        </div>

        {/* Stock Files Upload - Multiple files with drag and drop */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📦 Stock Bestanden (Optioneel - Meerdere bestanden mogelijk)
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActiveStock
                ? 'border-blue-500 bg-blue-50 scale-105'
                : stockFiles.length > 0
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragEnter={handleStockDrag}
            onDragLeave={handleStockDrag}
            onDragOver={handleStockDrag}
            onDrop={handleStockDrop}
          >
            <Upload className={`w-12 h-12 mx-auto mb-2 ${dragActiveStock ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="font-medium mb-1">Stock Excel Bestanden</p>
            {stockFiles.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Geselecteerde bestanden:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 max-h-32 overflow-y-auto">
                  {stockFiles.map((file, idx) => (
                    <li key={idx} className="text-green-700 font-semibold">{file.name}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Sleep meerdere bestanden hierheen of<br />
                klik om meerdere bestanden te selecteren
              </p>
            )}
            <input
              ref={stockInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              id="stock-upload"
              onChange={(e) => handleStockFilesSelect(e.target.files)}
            />
            <label
              htmlFor="stock-upload"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
            >
              {stockFiles.length > 0 ? 'Wijzig Bestanden' : 'Selecteer Bestanden'}
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Upload meerdere Excel bestanden (bijv. Stock Genk.xlsx, Stock Willebroek.xlsx, Stock Wilrijk.xlsx)
            </p>
          </div>
        </div>

            <div className="flex gap-4">
              <button
                onClick={handleProcess}
                disabled={isProcessing || (!pilsFile && stockFiles.length === 0 && !erpLinkFile)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Verwerken...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Verwerken
                  </>
                )}
              </button>
              {dataLoaded && (
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Vernieuwen
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {dataLoaded && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">
            ✅ <strong>Data geladen</strong> - Laatste update: {new Date().toLocaleString('nl-NL')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 0 && dataLoaded && (
            <ExecutiveDashboardTab overview={overviewData} transport={transportData} />
          )}
          {activeTab === 1 && dataLoaded && <OverviewTab overview={overviewData} />}
          {activeTab === 2 && dataLoaded && <TransportTab transport={transportData} overview={overviewData} />}
          {activeTab === 3 && dataLoaded && <ForecastTab />}
          {activeTab === 4 && dataLoaded && <PackedTab />}
          {activeTab === 5 && <StockAnalysisTab />}
          {activeTab === 6 && <KanbanTab />}
          {activeTab === 7 && dataLoaded && <BacklogTab overview={overviewData} />}
          {activeTab === 8 && <ErpLinkTab />}
          {activeTab !== 5 && activeTab !== 6 && activeTab !== 8 && !dataLoaded && (
            <div className="text-center py-12 text-gray-500">
              Upload bestanden en klik op &apos;Verwerken&apos; om deze tab te gebruiken.
            </div>
          )}
        </div>
      </div>

      {!dataLoaded && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800 text-lg mb-2">
            🚀 <strong>Welkom!</strong> Upload bestanden en klik op &apos;Verwerken&apos; om te beginnen.
          </p>
          <p className="text-blue-600 text-sm">
            💡 De eerste keer laden kan 15-20 seconden duren.
          </p>
        </div>
      )}
    </div>
  )
}
