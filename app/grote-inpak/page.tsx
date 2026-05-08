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
import KanbanTab from '@/components/grote-inpak/KanbanTab'
import ProductieOrdersTab from '@/components/grote-inpak/ProductieOrdersTab'
import UploadLogTab from '@/components/grote-inpak/UploadLogTab'

export default function GroteInpakPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [pilsFile, setPilsFile] = useState<File | null>(null)
  const [erpLinkFile, setErpLinkFile] = useState<File | null>(null)
  const [stockFiles, setStockFiles] = useState<File[]>([])
  // BC-overgang: markeer welke BC-omgeving een stock-upload komt van.
  // 'legacy' = oude BC (GP-codes), 'bc36' = nieuwe BC36 (FP-codes).
  // Beide kunnen tegelijk in de DB leven en worden per kist opgeteld.
  const [stockBcSource, setStockBcSource] = useState<'legacy' | 'bc36'>('bc36')
  const [transferFiles, setTransferFiles] = useState<File[]>([])
  const [transferUploading, setTransferUploading] = useState(false)
  const [transferFiles_DB, setTransferFiles_DB] = useState<any[]>([])
  const [dragActiveTransfer, setDragActiveTransfer] = useState(false)
  const [bcShopLinesUploading, setBcShopLinesUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<any[]>([])
  const [transportData, setTransportData] = useState<any[]>([])
  const [dragActivePils, setDragActivePils] = useState(false)
  const [dragActiveErpLink, setDragActiveErpLink] = useState(false)
  const [dragActiveStock, setDragActiveStock] = useState(false)
  const [uploadSectionExpanded, setUploadSectionExpanded] = useState(false)
  const [stockUploadTrigger, setStockUploadTrigger] = useState(0)
  const [uploadLogTrigger, setUploadLogTrigger] = useState(0)
  const pilsInputRef = useRef<HTMLInputElement>(null)
  const erpLinkInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)
  const transferInputRef = useRef<HTMLInputElement>(null)
  const bcShopLinesInputRef = useRef<HTMLInputElement>(null)

  const tabs = [
    { id: 0, label: 'Overzicht' },
    { id: 1, label: 'Transport' },
    { id: 2, label: 'Forecast' },
    { id: 3, label: 'Packed' },
    { id: 4, label: 'Stock' },
    { id: 5, label: 'Kanban' },
    { id: 6, label: 'Backlog' },
    { id: 7, label: 'ERP-koppeling' },
    { id: 9, label: 'Productieorders' },
    { id: 8, label: 'Uploadhistoriek' },
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

  // Transfer orders
  const loadTransferFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/grote-inpak/transfer')
      if (res.ok) {
        const result = await res.json()
        setTransferFiles_DB(result.files || [])
      }
    } catch {}
  }, [])

  useEffect(() => { loadTransferFiles() }, [loadTransferFiles])

  useEffect(() => {
    const handler = () => setUploadLogTrigger((k) => k + 1)
    window.addEventListener('grote-inpak-upload-log-refresh', handler)
    return () => window.removeEventListener('grote-inpak-upload-log-refresh', handler)
  }, [])

  const handleTransferDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActiveTransfer(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const handleBcShopLinesUpload = async () => {
    const file = bcShopLinesInputRef.current?.files?.[0]
    if (!file) {
      setError('Selecteer eerst een BC Excel-export (suffix/match-kolom + item/FP + Atlas).')
      return
    }
    setBcShopLinesUploading(true)
    setError(null)
    setSuccess(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/grote-inpak/bc-shop-lines/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload mislukt')
      setSuccess(
        `✅ BC-koppeling: ${json.cases_matched} cases bijgewerkt (${json.excel_rows_used} Excel-rijen, ${json.unique_match_keys} unieke match-keys). Cases in DB: ${json.cases_in_db}.`,
      )
      await loadDataFromDatabase()
      setTimeout(() => setSuccess(null), 8000)
    } catch (e: any) {
      setError(e.message || 'BC shop-regels upload mislukt')
    } finally {
      setBcShopLinesUploading(false)
    }
  }

  const handleTransferDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActiveTransfer(false)
    if (e.dataTransfer.files?.length > 0) {
      setTransferFiles(Array.from(e.dataTransfer.files).filter(f => /\.xlsx?$/i.test(f.name)))
    }
  }, [])

  const handleTransferUpload = async () => {
    if (transferFiles.length === 0) return
    setTransferUploading(true)
    try {
      const fd = new FormData()
      transferFiles.forEach(f => fd.append('files', f))
      const res = await fetch('/api/grote-inpak/transfer', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload mislukt')
      const ok = (result.results || []).filter((r: any) => r.status === 'ok')
      const skipFiles = (result.results || []).filter((r: any) => r.status === 'skip')
      const successParts = ok.map((r: any) => {
        let msg = `${r.file}: ${r.rijen} kisttype(n) gematcht, ${r.totaal_stuks} stuks`
        if (r.niet_gematcht_aantal > 0) msg += ` (${r.niet_gematcht_aantal} codes niet in ERP LINK: ${r.niet_gematcht_preview?.join(', ')})`
        return msg
      })
      if (skipFiles.length > 0) successParts.push(...skipFiles.map((r: any) => `⚠️ ${r.file}: ${r.message}`))
      setSuccess(`Transfer upload: ${successParts.join(' | ')}`)
      setTransferFiles([])
      await loadTransferFiles()
      setStockUploadTrigger(t => t + 1)
    } catch (err: any) {
      setError(err.message || 'Fout bij uploaden transferorders')
    } finally {
      setTransferUploading(false)
    }
  }

  const handleDeleteTransfer = async (sourceFile: string) => {
    if (!confirm(`Verwijder transferorder "${sourceFile}"?`)) return
    try {
      await fetch('/api/grote-inpak/transfer', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_file: sourceFile }),
      })
      await loadTransferFiles()
      setStockUploadTrigger(t => t + 1)
    } catch {}
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
          stockFormData.append('bcSource', stockBcSource)

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
            sourceFile: pilsFile?.name || null,
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

        await processResponse.json()
        await loadDataFromDatabase()
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
          const sourceLabel = stockBcSource === 'bc36' ? 'BC36' : 'Oude BC'
          successParts.push(`Stock (${sourceLabel}): ${stockUploaded} bestand(en), ${stockItemsProcessed} items verwerkt`)
          setStockUploadTrigger((k) => k + 1)
        }
        if (successParts.length > 0) {
          setSuccess(`✅ Bestanden succesvol verwerkt! ${successParts.join(' | ')}`)
          setTimeout(() => setSuccess(null), 5000)
        }
        if (pilsUploaded) setUploadLogTrigger((k) => k + 1)
      } else if (stockFiles.length > 0) {
        // If only stock files are uploaded, just refresh the stock tab
        // The stock data is already saved to the database
        await loadDataFromDatabase()
        setDataLoaded(true)
        setStockUploadTrigger((k) => k + 1)
        setSuccess(`✅ Stock bestanden succesvol geüpload (${stockBcSource === 'bc36' ? 'BC36' : 'Oude BC'})! ${stockUploaded} bestand(en), ${stockItemsProcessed} items verwerkt.`)
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
        
        // Transport = alle PILS cases (TransportTab filtert zelf op locatie/status)
        if (cases.length > 0) {
          setTransportData(cases)
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
    <div className="min-h-screen bg-[#e6eef8] text-slate-900 antialiased">
      <header className="border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#153d75] text-white shadow-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-white/20 bg-white/10 text-sm font-bold">
              GI
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">Atlas Copco</p>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Grote inpak</h1>
              <p className="mt-0.5 max-w-xl text-xs text-sky-100/90">
                PILS, stock, transfer en forecast. Tab <span className="font-medium text-white">Overzicht</span> is het
                hoofdscherm.
              </p>
            </div>
          </div>
          <div className="text-xs text-sky-100/95 tabular-nums">
            {new Date().toLocaleString('nl-BE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
      {/* File Upload Section */}
      <div className="mb-6 rounded-lg border border-slate-300/80 bg-white p-5 shadow-sm sm:p-6">
        <div
          className="-m-2 mb-4 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50"
          onClick={() => setUploadSectionExpanded(!uploadSectionExpanded)}
        >
          <h2 className="text-lg font-semibold text-slate-900">Data uploaden</h2>
          {uploadSectionExpanded ? (
            <ChevronUp className="w-6 h-6 text-gray-500" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-500" />
          )}
        </div>
        
        {uploadSectionExpanded && (
          <div>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300/80 bg-red-50 p-4 text-red-900">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300/80 bg-emerald-50 p-4 text-emerald-950">
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
              className="inline-block cursor-pointer rounded-lg bg-[#1a4b8c] px-4 py-2 text-white transition-colors hover:bg-[#153d75]"
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

          {/* BC-omgeving toggle: bron van deze upload.
              Oude en nieuwe uploads blijven naast elkaar in de DB bestaan
              en worden per kist opgeteld in de overzichten. */}
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900 mb-2">
              🔄 BC-omgeving van deze upload
            </p>
            <div className="flex flex-wrap gap-2">
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  stockBcSource === 'legacy'
                    ? 'border-amber-500 bg-white shadow-sm'
                    : 'border-transparent bg-white/60 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="stockBcSource"
                  value="legacy"
                  checked={stockBcSource === 'legacy'}
                  onChange={() => setStockBcSource('legacy')}
                  className="accent-amber-600"
                />
                <span className="text-sm text-gray-800">
                  <span className="font-semibold">Oude BC</span>
                  <span className="text-gray-500"> (GP-codes)</span>
                </span>
              </label>
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  stockBcSource === 'bc36'
                    ? 'border-amber-500 bg-white shadow-sm'
                    : 'border-transparent bg-white/60 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="stockBcSource"
                  value="bc36"
                  checked={stockBcSource === 'bc36'}
                  onChange={() => setStockBcSource('bc36')}
                  className="accent-amber-600"
                />
                <span className="text-sm text-gray-800">
                  <span className="font-semibold">Nieuwe BC36</span>
                  <span className="text-gray-500"> (FP-codes)</span>
                </span>
              </label>
            </div>
            <p className="text-xs text-amber-800 mt-2">
              Tijdens de overgang kan je zowel een oude als nieuwe stock-file uploaden voor dezelfde locatie
              (per bron apart in de database). Standaard staat <strong>Nieuwe BC36</strong> aan — zo wordt de
              voorraad uit de Excel (kolom Inventory / voorraad) opgeslagen. Kies <strong>alleen Oude BC</strong> als
              je bewust een GP-export uploadt: dan zetten we voorraad op 0 en bewaren we enkel het veld
              &quot;Qty. on Prod. Order&quot;. Upload je per ongeluk een FP-export met Oude BC, dan zie je dus wel
              productie maar geen stock Genk.
            </p>
          </div>

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
              className="inline-block cursor-pointer rounded-lg bg-[#1a4b8c] px-4 py-2 text-white transition-colors hover:bg-[#153d75]"
            >
              {stockFiles.length > 0 ? 'Wijzig Bestanden' : 'Selecteer Bestanden'}
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Upload meerdere Excel bestanden (bijv. Stock Genk.xlsx, Stock Willebroek.xlsx, Stock Wilrijk.xlsx)
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-lg">
          <label className="block text-sm font-medium text-sky-900 mb-2" htmlFor="bc-shop-lines-upload">
            📎 BC-export: shop-key, Atlas-mail en FP per lijn
          </label>
          <p className="text-xs text-sky-900/90 mb-3 max-w-4xl leading-relaxed">
            Na de PILS-upload: upload hier de BC/Oilfree-export. We matchen <strong>PILS serial (kolom F, volledig nummer)</strong> met
            de <strong>laatste 6 cijfers</strong> in Excel (typisch kolom <strong>I</strong>, of een <code>substr(…,11,6)</code>-kolom).
            <strong> Atlas Planner e-mail</strong> uit kolom <strong>H</strong>, <strong>FP</strong> uit <strong>No.</strong>, en{' '}
            <strong>Verkooporder (Document Nr.)</strong> wordt intern bijgehouden. Klanten zoeken hun status op via{' '}
            <a href="/klant/order-status" className="font-semibold underline decoration-sky-700/50 hover:decoration-sky-900">
              het klantportaal
            </a>{' '}
            met enkel het <strong>shopordernummer</strong>.
            . Voorloopnullen in Excel worden weer gelijkgetrokken voor de match.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={bcShopLinesInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full max-w-md text-sm text-sky-950 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white file:text-sm file:font-medium"
              id="bc-shop-lines-upload"
            />
            <button
              type="button"
              onClick={handleBcShopLinesUpload}
              disabled={bcShopLinesUploading}
              className="rounded-lg bg-[#1a4b8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153d75] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bcShopLinesUploading ? 'Koppelen…' : 'Upload & koppel aan PILS'}
            </button>
          </div>
        </div>

        {/* Transfer Orders Upload */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🚛 Transferorders (Kisten onderweg naar Willebroek — kolom A = ERP code, kolom F = stuks)
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActiveTransfer
                ? 'border-orange-500 bg-orange-50 scale-105'
                : transferFiles.length > 0
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-orange-400'
            }`}
            onDragEnter={handleTransferDrag}
            onDragLeave={handleTransferDrag}
            onDragOver={handleTransferDrag}
            onDrop={handleTransferDrop}
          >
            <Upload className={`w-12 h-12 mx-auto mb-2 ${dragActiveTransfer ? 'text-orange-500' : 'text-gray-400'}`} />
            <p className="font-medium mb-1">Transferorder Excel(s)</p>
            {transferFiles.length > 0 ? (
              <ul className="text-sm text-green-700 font-semibold mt-2 space-y-0.5">
                {transferFiles.map((f, i) => <li key={i}>{f.name}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mb-3">Sleep één of meerdere bestanden hierheen</p>
            )}
            <input ref={transferInputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" id="transfer-upload"
              onChange={e => setTransferFiles(Array.from(e.target.files || []))} />
            <label htmlFor="transfer-upload" className="inline-block mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer transition-colors">
              {transferFiles.length > 0 ? 'Wijzig bestanden' : 'Selecteer bestanden'}
            </label>
            {transferFiles.length > 0 && (
              <button onClick={handleTransferUpload} disabled={transferUploading}
                className="ml-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {transferUploading ? 'Uploaden...' : 'Upload transferorders'}
              </button>
            )}
          </div>
          {/* Actieve transferorders */}
          {transferFiles_DB.length > 0 && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-orange-800 mb-2">Actieve transferorders in database:</p>
              <ul className="space-y-1">
                {transferFiles_DB.map((tf: any) => (
                  <li key={tf.source_file} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="font-medium">{tf.source_file}</span>
                      <span className="text-gray-500 ml-2">— {tf.aantal_rijen} kisttypen · {tf.totaal_stuks} stuks</span>
                    </span>
                    <button onClick={() => handleDeleteTransfer(tf.source_file)}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors">
                      Verwijder
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleProcess}
                disabled={isProcessing || (!pilsFile && stockFiles.length === 0 && !erpLinkFile)}
                className="flex items-center gap-2 rounded-lg bg-[#1a4b8c] px-6 py-3 font-semibold text-white transition-all hover:bg-[#153d75] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
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
        <div className="mb-6 rounded-lg border border-emerald-300/80 bg-emerald-50/90 p-4 shadow-sm">
          <p className="text-sm text-emerald-950">
            <strong>Data geladen</strong> — laatste refresh: {new Date().toLocaleString('nl-BE')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-hidden rounded-lg border border-slate-400/90 shadow-md">
        <nav
          className="flex gap-0.5 overflow-x-auto border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#153d75] px-1 pt-1"
          aria-label="Grote inpak"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-t-md px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
                activeTab === tab.id
                  ? 'bg-white text-[#1a4b8c] shadow-sm'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="bg-white p-5 sm:p-6">
          {activeTab === 0 && dataLoaded && <OverviewTab overview={overviewData} />}
          {activeTab === 1 && dataLoaded && <TransportTab transport={transportData} overview={overviewData} />}
          {activeTab === 2 && dataLoaded && <ForecastTab />}
          {activeTab === 3 && dataLoaded && <PackedTab />}
          {activeTab === 4 && <StockAnalysisTab />}
          {activeTab === 5 && <KanbanTab stockUploadTrigger={stockUploadTrigger} />}
          {activeTab === 6 && dataLoaded && <BacklogTab overview={overviewData} />}
          {activeTab === 7 && <ErpLinkTab />}
          {activeTab === 9 && <ProductieOrdersTab />}
          {activeTab === 8 && <UploadLogTab refreshTrigger={uploadLogTrigger} />}
          {activeTab !== 4 && activeTab !== 5 && activeTab !== 7 && activeTab !== 8 && activeTab !== 9 && !dataLoaded && (
            <div className="text-center py-12 text-gray-500">
              Upload bestanden en klik op &apos;Verwerken&apos; om deze tab te gebruiken.
            </div>
          )}
        </div>
      </div>

      {!dataLoaded && (
        <div className="mt-6 rounded-lg border border-slate-300/80 bg-white p-6 text-center shadow-sm">
          <p className="mb-2 text-lg text-slate-800">
            <strong>Welkom</strong> — upload bestanden en klik op &apos;Verwerken&apos; om te beginnen.
          </p>
          <p className="text-sm text-slate-600">De eerste keer laden kan even duren.</p>
        </div>
      )}
      </div>
    </div>
  )
}
