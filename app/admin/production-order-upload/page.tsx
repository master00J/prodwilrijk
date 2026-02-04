'use client'

import { useCallback, useRef, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { parseProductionOrderXml } from '@/lib/production-order/parse-xml'

export default function ProductionOrderUploadPage() {
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const xmlFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith('.xml'))
    if (xmlFiles.length === 0) {
      setMessage({ type: 'error', text: 'Selecteer XML bestanden (.xml)' })
      return
    }
    setXmlFile(xmlFiles[0])
    setMessage(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleUpload = async () => {
    if (!xmlFile) {
      setMessage({ type: 'error', text: 'Selecteer een XML bestand' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const parsed = await parseProductionOrderXml(xmlFile)
      if (!parsed.lines || parsed.lines.length === 0) {
        throw new Error('Geen productieorder lijnen gevonden in XML.')
      }

      const response = await fetch('/api/production-orders/upload-for-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Fout bij uploaden productieorder')
      }

      setMessage({
        type: 'success',
        text: `Productieorder ${result.order_number} geüpload met ${result.line_count} lijnen. Dit order is nu zichtbaar op de pagina Productie order tijd.`,
      })
      setXmlFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error: any) {
      console.error('Error uploading XML:', error)
      setMessage({ type: 'error', text: error.message || 'Fout bij uploaden XML' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Productieorder XML upload</h1>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          <p className="font-medium mb-1">Tijdregistratie-flow</p>
          <p>
            Upload hier een productieorder XML. Alleen orders die via deze pagina worden geüpload, verschijnen op de
            pagina <strong>Productie order tijd</strong> voor tijdregistratie (Zagen, Assemblage, enz.).
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-gray-50 hover:border-amber-400'
            }`}
          >
            <div className="space-y-4">
              <div className="text-4xl">📄</div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Sleep een XML bestand hierheen of klik om te selecteren
                </p>
                <p className="text-sm text-gray-500 mt-2">Alleen .xml bestanden</p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFiles([f])
                    setMessage(null)
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-block px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
                >
                  Selecteer XML
                </button>
              </div>
            </div>
          </div>

          {xmlFile && (
            <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">{xmlFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setXmlFile(null)
                  fileInputRef.current && (fileInputRef.current.value = '')
                }}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                ✕ Verwijderen
              </button>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !xmlFile}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 font-medium"
            >
              {uploading ? 'Uploaden...' : 'Upload XML'}
            </button>
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}
