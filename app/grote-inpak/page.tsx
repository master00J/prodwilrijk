'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Database, RefreshCw, AlertCircle } from 'lucide-react'
import OverviewTab from '@/components/grote-inpak/OverviewTab'
import ExecutiveDashboardTab from '@/components/grote-inpak/ExecutiveDashboardTab'
import TransportTab from '@/components/grote-inpak/TransportTab'
import ForecastTab from '@/components/grote-inpak/ForecastTab'
import PackedTab from '@/components/grote-inpak/PackedTab'
import StockAnalysisTab from '@/components/grote-inpak/StockAnalysisTab'
import KanbanTab from '@/components/grote-inpak/KanbanTab'
import BacklogTab from '@/components/grote-inpak/BacklogTab'

export default function GroteInpakPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [pilsFile, setPilsFile] = useState<File | null>(null)
  const [erpFile, setErpFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<any[]>([])
  const [transportData, setTransportData] = useState<any[]>([])
  const [dragActivePils, setDragActivePils] = useState(false)
  const [dragActiveErp, setDragActiveErp] = useState(false)
  const pilsInputRef = useRef<HTMLInputElement>(null)
  const erpInputRef = useRef<HTMLInputElement>(null)

  const tabs = [
    { id: 0, label: '📊 Executive Dashboard', icon: '📊' },
    { id: 1, label: '📋 Overzicht', icon: '📋' },
    { id: 2, label: '🚚 Transport', icon: '🚚' },
    { id: 3, label: '📈 Forecast', icon: '📈' },
    { id: 4, label: '📦 Packed', icon: '📦' },
    { id: 5, label: '📊 Stock Analyse', icon: '📊' },
    { id: 6, label: '📦 Kanban Rekken', icon: '📦' },
    { id: 7, label: '⏰ Backlog', icon: '⏰' },
  ]

  const handleFileSelect = (type: 'pils' | 'erp', file: File | null) => {
    if (type === 'pils') {
      setPilsFile(file)
    } else {
      setErpFile(file)
    }
    setError(null)
  }

  const handleDrag = (e: React.DragEvent, type: 'pils' | 'erp') => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'pils') {
      setDragActivePils(e.type === 'dragenter' || e.type === 'dragover')
    } else {
      setDragActiveErp(e.type === 'dragenter' || e.type === 'dragover')
    }
  }

  const handleDrop = (e: React.DragEvent, type: 'pils' | 'erp') => {
    e.preventDefault()
    e.stopPropagation()
    
    if (type === 'pils') {
      setDragActivePils(false)
    } else {
      setDragActiveErp(false)
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const isValidType = type === 'pils' 
        ? file.name.endsWith('.csv')
        : file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      
      if (isValidType) {
        handleFileSelect(type, file)
      } else {
        setError(`Ongeldig bestandstype. ${type === 'pils' ? 'Verwacht: .csv' : 'Verwacht: .xlsx of .xls'}`)
      }
    }
  }

  const handleProcess = async () => {
    if (!pilsFile || !erpFile) {
      setError('Please upload both PILS CSV and ERP Excel files')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Upload PILS file
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

      const pilsResult = await pilsResponse.json()

      // Upload ERP file
      const erpFormData = new FormData()
      erpFormData.append('file', erpFile)
      erpFormData.append('fileType', 'erp')

      const erpResponse = await fetch('/api/grote-inpak/upload', {
        method: 'POST',
        body: erpFormData,
      })

      if (!erpResponse.ok) {
        const erpError = await erpResponse.json()
        throw new Error(erpError.error || 'Error uploading ERP file')
      }

      const erpResult = await erpResponse.json()

      // Process data
      const processResponse = await fetch('/api/grote-inpak/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pilsData: pilsResult.data,
          erpData: erpResult.data,
        }),
      })

      if (!processResponse.ok) {
        const processError = await processResponse.json()
        throw new Error(processError.error || 'Error processing data')
      }

      const processResult = await processResponse.json()
      setOverviewData(processResult.overview || [])
      setTransportData(processResult.transport || [])
      setDataLoaded(true)
    } catch (err: any) {
      console.error('Process error:', err)
      setError(err.message || 'Error processing files')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRefresh = async () => {
    setDataLoaded(false)
    setOverviewData([])
    setTransportData([])
    setPilsFile(null)
    setErpFile(null)
    setError(null)
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
        <h2 className="text-2xl font-semibold mb-4">📁 Bestanden Uploaden</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
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
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActiveErp
                ? 'border-blue-500 bg-blue-50 scale-105'
                : erpFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragEnter={(e) => handleDrag(e, 'erp')}
            onDragLeave={(e) => handleDrag(e, 'erp')}
            onDragOver={(e) => handleDrag(e, 'erp')}
            onDrop={(e) => handleDrop(e, 'erp')}
          >
            <FileSpreadsheet className={`w-12 h-12 mx-auto mb-2 ${dragActiveErp ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="font-medium mb-1">ERP Excel</p>
            <p className="text-sm text-gray-500 mb-3">
              {erpFile ? (
                <span className="text-green-700 font-semibold">{erpFile.name}</span>
              ) : (
                <>
                  Sleep bestand hierheen of<br />
                  klik om te selecteren
                </>
              )}
            </p>
            <input
              ref={erpInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="erp-upload"
              onChange={(e) => handleFileSelect('erp', e.target.files?.[0] || null)}
            />
            <label
              htmlFor="erp-upload"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
            >
              {erpFile ? 'Wijzig Bestand' : 'Selecteer Bestand'}
            </label>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleProcess}
            disabled={isProcessing || !pilsFile || !erpFile}
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

      {/* Status Message */}
      {dataLoaded && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">
            ✅ <strong>Data geladen</strong> - Laatste update: {new Date().toLocaleString('nl-NL')}
          </p>
        </div>
      )}

      {/* Tabs */}
      {dataLoaded && (
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
            {activeTab === 0 && <ExecutiveDashboardTab overview={overviewData} transport={transportData} />}
            {activeTab === 1 && <OverviewTab overview={overviewData} />}
            {activeTab === 2 && <TransportTab transport={transportData} overview={overviewData} />}
            {activeTab === 3 && <ForecastTab />}
            {activeTab === 4 && <PackedTab />}
            {activeTab === 5 && <StockAnalysisTab />}
            {activeTab === 6 && <KanbanTab />}
            {activeTab === 7 && <BacklogTab overview={overviewData} />}
          </div>
        </div>
      )}

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
