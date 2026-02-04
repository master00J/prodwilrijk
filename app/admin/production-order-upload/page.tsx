'use client'

import { useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { parseProductionOrderXml } from '@/lib/production-order/parse-xml'

export default function ProductionOrderUploadPage() {
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
          <label className="block text-sm font-medium text-gray-700 mb-2">XML bestand</label>
          <input
            type="file"
            accept=".xml"
            onChange={(e) => {
              setXmlFile(e.target.files?.[0] || null)
              setMessage(null)
            }}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-white file:font-medium"
          />
          {xmlFile && (
            <p className="mt-2 text-sm text-gray-500">
              Geselecteerd: <span className="font-medium">{xmlFile.name}</span>
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
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
