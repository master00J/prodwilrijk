'use client'

import { useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

interface ImportResult {
  success: boolean
  dryRun: boolean
  truncate: boolean
  packedItems: number
  timeLogs: number
  createdEmployees: number
  error?: string
}

export default function AirtecLegacyImportPage() {
  const [packedFile, setPackedFile] = useState<File | null>(null)
  const [timelogFile, setTimelogFile] = useState<File | null>(null)
  const [truncate, setTruncate] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!packedFile || !timelogFile) {
      setResult({
        success: false,
        dryRun,
        truncate,
        packedItems: 0,
        timeLogs: 0,
        createdEmployees: 0,
        error: 'Selecteer beide SQL bestanden.',
      })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('packedFile', packedFile)
      formData.append('timelogsFile', timelogFile)
      formData.append('truncate', String(truncate))
      formData.append('dryRun', String(dryRun))

      const response = await fetch('/api/admin/airtec-legacy-import', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Import mislukt')
      }
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        dryRun,
        truncate,
        packedItems: 0,
        timeLogs: 0,
        createdEmployees: 0,
        error: error.message || 'Import mislukt',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Airtec legacy import</h1>
        <p className="text-gray-600 mb-6">
          Upload de oude SQL dumps om de Airtec KPI’s terug te vullen.
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              packed_items_airtec.sql
            </label>
            <input
              type="file"
              accept=".sql"
              onChange={(event) => setPackedFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              airtec_timelogs.sql
            </label>
            <input
              type="file"
              accept=".sql"
              onChange={(event) => setTimelogFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={truncate}
                onChange={(event) => setTruncate(event.target.checked)}
              />
              Bestaande Airtec data wissen
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
              />
              Dry run (geen inserts)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Import bezig...' : 'Import starten'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 rounded-lg border p-4 ${
              result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            {result.success ? (
              <div className="text-sm text-green-700 space-y-1">
                <div>Import gelukt {result.dryRun ? '(dry run)' : ''}.</div>
                <div>Packed items: {result.packedItems}</div>
                <div>Time logs: {result.timeLogs}</div>
                <div>Nieuwe employees: {result.createdEmployees}</div>
                {result.truncate && <div>Bestaande data werd gewist.</div>}
              </div>
            ) : (
              <div className="text-sm text-red-700">
                {result.error || 'Import mislukt.'}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
