'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'

export default function WmsProjectImportPage() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement
    const file = input?.files?.[0]

    if (!file) {
      setMessage({ type: 'error', text: 'Selecteer een Excel-bestand.' })
      return
    }

    setUploading(true)
    setMessage(null)
    setProjectId(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/wms-projects/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Import mislukt')
      }

      setMessage({
        type: 'success',
        text: `Project ${data.projectNo} geïmporteerd (${data.insertedLines} lijnen).`,
      })
      setProjectId(data.projectId)
      setSelectedFileName(null)
      input.value = ''
    } catch (error: any) {
      console.error('Error importing WMS project:', error)
      setMessage({ type: 'error', text: error.message || 'Import mislukt' })
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedFileName(file ? file.name : null)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    const input = document.getElementById('wms-project-file-input') as HTMLInputElement | null
    if (!input) return

    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    setSelectedFileName(file.name)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">WMS Project import</h1>
      <p className="text-gray-600 mb-6">
        Upload het Packing Assignment Excel-bestand om een nieuw project aan te maken met alle
        verpakkingslijnen.
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Excel-bestand</label>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input
                id="wms-project-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-sm text-gray-600 mb-2">
                Sleep je Excel-bestand hierheen of klik om te kiezen.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('wms-project-file-input')?.click()}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Bestand kiezen
              </button>
              {selectedFileName && (
                <p className="mt-3 text-sm text-green-700">Geselecteerd: {selectedFileName}</p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploading ? 'Bezig met importeren...' : 'Importeer project'}
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {projectId && (
          <div className="mt-4">
            <Link
              href={`/wms-projecten/${projectId}`}
              className="text-blue-600 hover:underline font-medium"
            >
              Ga naar project
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
