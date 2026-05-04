'use client'

import { useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type SummaryFile = {
  location: 'Wilrijk' | 'Genk'
  rows: number
  totalQuantity: number
  filename: string
}

type ConversionSummary = {
  files: SummaryFile[]
  skippedNonFp: Array<{ code: string; location: string; quantity: number }>
  sourceRows: number
}

export default function BcForecastConverterPage() {
  const [converting, setConverting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [summary, setSummary] = useState<ConversionSummary | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const handleConvert = async () => {
    setConverting(true)
    setMessage(null)
    setSummary(null)

    try {
      const response = await fetch('/api/bc-forecast-converter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Conversie mislukt.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      link.href = url
      link.download = filenameMatch?.[1] || 'BC Forecast FP Nog te starten.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const summaryHeader = response.headers.get('X-Forecast-Summary')
      if (summaryHeader) {
        setSummary(JSON.parse(decodeURIComponent(summaryHeader)) as ConversionSummary)
      }

      setMessage({
        type: 'success',
        text: 'Forecast uit de website geconverteerd. De ZIP met Genk en Wilrijk is gedownload.',
      })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Conversie mislukt.' })
    } finally {
      setConverting(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-4">BC Forecast Converter</h1>
        <p className="text-gray-600 mb-6">
          Maakt rechtstreeks vanuit de forecastgegevens in de website Business Central-matrixbestanden met alleen
          rode regels (&quot;nog te starten&quot;), opgesplitst voor Wilrijk en Genk en met de nieuwe FP-codes.
        </p>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Van datum</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tot datum</label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
            De converter gebruikt dezelfde forecast, stock, transfer, inkooporders en lopende productieorders als de
            bestaande Forecast matrix in Grote Inpak. Je hoeft dus geen Excel meer te uploaden.
          </div>

          <button
            type="button"
            onClick={handleConvert}
            disabled={converting}
            className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {converting ? 'Converteren...' : 'Download BC forecast ZIP'}
          </button>

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {summary && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mt-6">
            <h2 className="text-xl font-semibold mb-3">Resultaat</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.files.map((file) => (
                <div key={file.location} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="font-semibold">{file.location}</div>
                  <div className="text-sm text-gray-600 mt-1">{file.rows} FP-regels</div>
                  <div className="text-sm text-gray-600">{file.totalQuantity} stuks nog te starten</div>
                </div>
              ))}
            </div>

            {summary.skippedNonFp.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                {summary.skippedNonFp.length} rode regel(s) zonder FP-code zijn overgeslagen, bijvoorbeeld{' '}
                {summary.skippedNonFp.slice(0, 3).map((item) => item.code).join(', ')}.
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 text-sm text-blue-900">
          <p className="font-medium mb-1">Wat doet deze converter?</p>
          <p>
            De export bouwt eerst de bestaande Forecast matrix op, neemt daar alleen de rode cellen uit, filtert op
            <strong> FP</strong>-codes en maakt twee Excelbestanden in een ZIP: een voor Wilrijk en een voor Genk.
          </p>
        </div>
      </div>
    </AdminGuard>
  )
}
