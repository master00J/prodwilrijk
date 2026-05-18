'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type Warning = {
  field: string | null
  message: string
  source_quote: string | null
}

type SourceValue<T = string | number> = {
  value: T | null
  source_quote: string | null
  warnings: Warning[]
}

type ExtractedHeader = {
  customer_name: SourceValue<string>
  customer_order_number: SourceValue<string>
  order_date: SourceValue<string>
  requested_delivery_date: SourceValue<string>
  delivery_address: SourceValue<string>
  currency: SourceValue<string>
}

type ExtractedLine = {
  line_number: number
  sku: SourceValue<string>
  sku_raw: SourceValue<string>
  description: SourceValue<string>
  quantity: SourceValue<number>
  unit_of_measure: SourceValue<string>
  unit_price: SourceValue<number>
  requested_delivery_date: SourceValue<string>
  raw_source_text: string | null
  validation_status: string
  validation_notes: string | null
  _warnings: Warning[]
}

type ExtractedOrder = {
  schema_version: string
  header: ExtractedHeader
  lines: ExtractedLine[]
  _warnings: Warning[]
}

type OrderflowDocumentDetail = {
  id: string
  source: string
  customer_label: string | null
  file_path: string
  mime_type: string
  original_filename: string
  file_size_bytes: number | null
  raw_text: string | null
  status: string
  error: string | null
  received_at: string
  created_at: string
}

type OrderflowExtractionDetail = {
  id: string
  model: string
  prompt_version: string
  parsed_order: ExtractedOrder
  confidence: number | null
  cost_usd: number | null
  latency_ms: number | null
  created_at: string
}

type DetailResponse = {
  document?: OrderflowDocumentDetail
  extraction?: OrderflowExtractionDetail | null
  error?: string
}

const HEADER_FIELDS: Array<{ key: keyof ExtractedHeader; label: string }> = [
  { key: 'customer_name', label: 'Klant' },
  { key: 'customer_order_number', label: 'Klantorder' },
  { key: 'order_date', label: 'Orderdatum' },
  { key: 'requested_delivery_date', label: 'Leverdatum' },
  { key: 'delivery_address', label: 'Leveradres' },
  { key: 'currency', label: 'Valuta' },
]

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function SourceQuote({ quote }: { quote: string | null }) {
  if (!quote) return null
  return (
    <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
      Bron: “{quote}”
    </div>
  )
}

function WarningList({ warnings }: { warnings: Warning[] }) {
  if (!warnings.length) return null
  return (
    <div className="space-y-1">
      {warnings.map((warning, index) => (
        <div key={`${warning.field || 'warning'}-${index}`} className="rounded bg-red-50 px-2 py-1 text-xs text-red-800">
          {warning.field ? `${warning.field}: ` : ''}{warning.message}
          {warning.source_quote ? ` (${warning.source_quote})` : ''}
        </div>
      ))}
    </div>
  )
}

function HeaderField({ label, field }: { label: string; field: SourceValue<string> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{formatValue(field.value)}</div>
      <SourceQuote quote={field.source_quote} />
      <WarningList warnings={field.warnings || []} />
    </div>
  )
}

export default function OrderflowReviewPage() {
  const params = useParams<{ documentId: string }>()
  const documentId = params.documentId
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/orderflow/documents/${documentId}`, { cache: 'no-store' })
        const data: DetailResponse = await response.json()
        if (!response.ok) throw new Error(data.error || 'Orderflow document laden mislukt.')
        setDetail(data)
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Orderflow document laden mislukt.'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [documentId])

  const parsedOrder = detail?.extraction?.parsed_order || null
  const rawText = detail?.document?.raw_text?.trim() || ''
  const documentWarnings = useMemo(() => parsedOrder?._warnings || [], [parsedOrder])

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Review laden...</main>
  }

  if (error || !detail?.document) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <Link href="/orderflow" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          Terug naar orderflow
        </Link>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error || 'Document niet gevonden.'}
        </div>
      </main>
    )
  }

  const document = detail.document

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-none px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/orderflow" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              Terug naar orderflow
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Order review</h1>
            <p className="mt-1 text-sm text-slate-600">
              {document.original_filename} · {document.customer_label || 'geen klantlabel'} · {document.status}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <div>Type: {document.mime_type}</div>
            <div>Grootte: {formatFileSize(document.file_size_bytes)}</div>
            <div>Ontvangen: {new Date(document.received_at || document.created_at).toLocaleString('nl-BE')}</div>
          </div>
        </div>

        {document.error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Laatste fout: {document.error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-xl font-semibold text-slate-900">Brontekst</h2>
              <p className="text-sm text-slate-500">Raw tekst uit upload. PDF-rendering volgt later.</p>
            </div>
            {rawText ? (
              <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap p-4 text-sm leading-6 text-slate-800">
                {rawText}
              </pre>
            ) : (
              <div className="p-4 text-sm text-slate-600">
                Geen raw tekst beschikbaar voor dit document. Dit gebeurt meestal bij gescande PDF-bestanden zonder tekstlaag;
                OCR/vision en PDF-weergave komen in een aparte stap.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-xl font-semibold text-slate-900">AI-extractie</h2>
              {detail.extraction ? (
                <p className="text-sm text-slate-500">
                  {detail.extraction.model} · prompt {detail.extraction.prompt_version} ·{' '}
                  {detail.extraction.latency_ms ? `${detail.extraction.latency_ms} ms` : 'latency onbekend'}
                </p>
              ) : (
                <p className="text-sm text-slate-500">Nog geen extractie gevonden.</p>
              )}
            </div>

            {!parsedOrder ? (
              <div className="p-4 text-sm text-slate-600">Start eerst een extractie vanuit de orderflow queue.</div>
            ) : (
              <div className="space-y-5 p-4">
                <WarningList warnings={documentWarnings} />

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">Header</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {HEADER_FIELDS.map(field => (
                      <HeaderField key={field.key} label={field.label} field={parsedOrder.header[field.key]} />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">Orderlijnen</h3>
                  {parsedOrder.lines.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                      Geen lijnen gevonden in de extractie.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                            <th className="px-3 py-2 font-semibold">Lijn</th>
                            <th className="px-3 py-2 font-semibold">SKU</th>
                            <th className="px-3 py-2 font-semibold">Omschrijving</th>
                            <th className="px-3 py-2 font-semibold">Aantal</th>
                            <th className="px-3 py-2 font-semibold">Eenheid</th>
                            <th className="px-3 py-2 font-semibold">Prijs</th>
                            <th className="px-3 py-2 font-semibold">Warnings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedOrder.lines.map(line => (
                            <tr key={line.line_number} className="border-b border-slate-100 align-top last:border-0">
                              <td className="px-3 py-3 font-semibold text-slate-900">{line.line_number}</td>
                              <td className="px-3 py-3">
                                <div>{formatValue(line.sku.value || line.sku_raw.value)}</div>
                                <SourceQuote quote={line.sku.source_quote || line.sku_raw.source_quote} />
                              </td>
                              <td className="px-3 py-3">
                                <div className="max-w-sm">{formatValue(line.description.value)}</div>
                                <SourceQuote quote={line.description.source_quote} />
                              </td>
                              <td className="px-3 py-3">
                                {formatValue(line.quantity.value)}
                                <SourceQuote quote={line.quantity.source_quote} />
                              </td>
                              <td className="px-3 py-3">
                                {formatValue(line.unit_of_measure.value)}
                                <SourceQuote quote={line.unit_of_measure.source_quote} />
                              </td>
                              <td className="px-3 py-3">
                                {formatValue(line.unit_price.value)}
                                <SourceQuote quote={line.unit_price.source_quote} />
                              </td>
                              <td className="px-3 py-3">
                                <WarningList warnings={line._warnings || []} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
