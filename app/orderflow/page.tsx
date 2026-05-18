'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type OrderflowDocument = {
  id: string
  source: string
  customer_label: string | null
  original_filename: string
  mime_type: string
  file_size_bytes: number | null
  status: string
  error: string | null
  received_at: string
  created_at: string
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function OrderflowPage() {
  const [documents, setDocuments] = useState<OrderflowDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/orderflow/upload', { cache: 'no-store' })
      const data: { documents?: OrderflowDocument[]; error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Orderflow documenten laden mislukt.')
      setDocuments(data.documents || [])
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Orderflow documenten laden mislukt.') })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const uploadDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUploading(true)
    setMessage(null)

    const form = event.currentTarget
    const formData = new FormData(form)

    try {
      const response = await fetch('/api/orderflow/upload', {
        method: 'POST',
        body: formData,
      })
      const data: { document?: { original_filename: string; raw_text_available: boolean }; error?: string } =
        await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload mislukt.')

      setMessage({
        type: 'success',
        text: `${data.document?.original_filename || 'Document'} is opgeslagen${
          data.document?.raw_text_available ? ' met raw tekst.' : '.'
        }`,
      })
      form.reset()
      await loadDocuments()
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Upload mislukt.') })
    } finally {
      setUploading(false)
    }
  }

  const startExtraction = async (document: OrderflowDocument) => {
    setExtractingId(document.id)
    setMessage(null)

    try {
      const response = await fetch('/api/orderflow/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      })
      const data: { extraction?: { id: string; model: string }; error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Extractie mislukt.')

      setMessage({
        type: 'success',
        text: `Extractie gestart en opgeslagen voor ${document.original_filename} (${data.extraction?.model || 'AI'}).`,
      })
      await loadDocuments()
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Extractie mislukt.') })
      await loadDocuments()
    } finally {
      setExtractingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Orderflow</p>
          <h1 className="text-3xl font-bold text-slate-900">Order intake queue</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Eerste scaffold voor manuele uploads. Deze stap bewaart het originele document en raw tekst waar
            beschikbaar; AI-extractie kan nu gestart worden voor documenten met tekstinput.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form onSubmit={uploadDocument} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold text-slate-900">Document uploaden</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ondersteund in deze scaffold: PDF, Excel, CSV, e-mailbestand en platte tekst.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Klantlabel (optioneel)
                <input
                  name="customerLabel"
                  type="text"
                  placeholder="Vrij tekstlabel tot echte masterdata gekoppeld is"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Bestand
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.eml,.txt,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,message/rfc822"
                  required
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-400"
            >
              {uploading ? 'Uploaden...' : 'Upload naar orderflow'}
            </button>
          </form>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-sm text-blue-950">
            <h2 className="text-lg font-semibold">Waarom deze beperkte start?</h2>
            <p className="mt-2">
              OpenAI is standaard voor extractie via de orderflow provider-config. Digitale PDF-bestanden met
              tekstlaag, Excel, CSV, EML en TXT krijgen raw tekst; gescande PDF-bestanden volgen later via OCR/vision.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Laatste documenten</h2>
              <p className="text-sm text-slate-500">De eerste review queue toont voorlopig alleen uploadstatus.</p>
            </div>
            <button
              type="button"
              onClick={() => loadDocuments()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vernieuwen
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Laden...</div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nog geen orderflow documenten geüpload.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-5 py-3 font-semibold">Bestand</th>
                    <th className="px-5 py-3 font-semibold">Klantlabel</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Grootte</th>
                    <th className="px-5 py-3 font-semibold">Ontvangen</th>
                    <th className="px-5 py-3 font-semibold">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(document => (
                    <tr key={document.id} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{document.original_filename}</div>
                        {document.error && <div className="mt-1 max-w-md text-xs text-red-700">{document.error}</div>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{document.customer_label || '-'}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {document.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{document.mime_type}</td>
                      <td className="px-5 py-3 text-slate-600">{formatFileSize(document.file_size_bytes)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(document.received_at || document.created_at).toLocaleString('nl-BE')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startExtraction(document)}
                            disabled={
                              extractingId === document.id ||
                              !['uploaded', 'error'].includes(document.status)
                            }
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                          >
                            {extractingId === document.id ? 'Bezig...' : 'Extractie starten'}
                          </button>
                          {['extracted', 'error'].includes(document.status) && (
                            <Link
                              href={`/orderflow/queue/${document.id}`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Bekijk review
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
