'use client'

import { useState } from 'react'

type PortalLine = {
  case_label: string
  case_type: string | null
  productielocatie: string | null
  in_willebroek: boolean
  arrival_indicative: string | null
  deadline: string | null
  days_overdue: number
  description: string | null
  fp_code: string | null
  shop_reference: string | null
  progress: {
    headline: string
    detail: string | null
    production_step: string | null
  }
}

type PortalResultGroup = {
  shop_order_key: string
  queried_as: string
  found: boolean
  lines: PortalLine[]
}

function formatNlDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('nl-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function LineCard({ line }: { line: PortalLine }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Kist / label</p>
          <p className="text-lg font-semibold text-slate-900">{line.case_label}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            Type: <span className="font-medium">{line.case_type || '—'}</span>
            {line.shop_reference ? (
              <>
                {' '}
                · Ref. <span className="font-mono">{line.shop_reference}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-right max-w-[min(100%,18rem)]">
          <p className="text-xs text-teal-800 font-medium">Status</p>
          <p className="text-sm font-semibold text-teal-950 leading-snug">{line.progress.headline}</p>
        </div>
      </div>

      {line.progress.detail && <p className="mt-3 text-sm text-slate-700">{line.progress.detail}</p>}

      {line.description && (
        <p className="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-3">{line.description}</p>
      )}

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm border-t border-slate-100 pt-3">
        <div>
          <dt className="text-slate-500">Geplande einddatum (intern)</dt>
          <dd className="font-medium text-slate-900">{formatNlDate(line.deadline)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Locatie</dt>
          <dd className="font-medium text-slate-900">
            {line.in_willebroek ? 'Willebroek (WMS)' : line.productielocatie || '—'}
          </dd>
        </div>
        {line.days_overdue > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-rose-600 font-medium">Let op</dt>
            <dd className="text-rose-800">
              Deze lijn staat momenteel {line.days_overdue}{' '}
              {line.days_overdue === 1 ? 'werkdag' : 'werkdagen'} over de interne planning.
            </dd>
          </div>
        )}
      </dl>
    </li>
  )
}

export default function KlantOrderStatusPage() {
  const [shopOrdersInput, setShopOrdersInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<PortalResultGroup[] | null>(null)
  const [summary, setSummary] = useState<{ total_lines: number; total_requested: number } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResults(null)
    setSummary(null)
    setLoading(true)
    try {
      const res = await fetch('/api/portal/grote-inpak-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopOrder: shopOrdersInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Opzoeken mislukt')
        return
      }
      setResults(json.results || [])
      setSummary({
        total_lines: json.total_lines ?? 0,
        total_requested: json.total_requested ?? 0,
      })
    } catch {
      setError('Netwerkfout. Controleer uw verbinding.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="w-full min-h-screen bg-slate-100/60">
      <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-10 pb-24">
        <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8 lg:p-10">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Orderstatus</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Vul één of <strong>meerdere shopordernummers</strong> in (zoals op uw orderbevestiging):{' '}
          <strong>één nummer per regel</strong>, of <strong>komma&apos;s / puntkomma&apos;s</strong> tussen de nummers.
          Langere referenties mogen; we herkennen dezelfde code als in ons systeem, ook zonder voorloopnullen.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="shop" className="block text-sm font-medium text-slate-700 mb-1">
              Shoporder(s)
            </label>
            <textarea
              id="shop"
              rows={5}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 font-mono text-sm"
              placeholder={'941001\n941002\n941003\n\nof: 941001, 941002; 941003'}
              value={shopOrdersInput}
              onChange={(e) => setShopOrdersInput(e.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">Maximaal 35 nummers per keer.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-teal-700 text-white font-semibold px-5 py-2.5 hover:bg-teal-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Zoeken…' : 'Status opvragen'}
          </button>
        </form>
        </div>

        {error && (
        <div
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          {error}
        </div>
        )}

        {results && results.length > 0 && summary && (
        <section className="mt-10 space-y-8 w-full" aria-label="Resultaten">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{summary.total_requested}</span>{' '}
            {summary.total_requested === 1 ? 'uniek shopordernummer' : 'unieke shopordernummers'} ·{' '}
            <span className="font-medium text-slate-800">{summary.total_lines}</span>{' '}
            {summary.total_lines === 1 ? 'gevonden lijn' : 'gevonden lijnen'}{' '}
            {summary.total_lines === 0 && '(controleer de nummers)'}
          </p>

          {results.map((group) => (
            <div key={group.shop_order_key} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
                Shoporder · <span className="font-mono">{group.shop_order_key}</span>
                {group.queried_as !== group.shop_order_key && (
                  <span className="font-normal text-slate-500 text-base ml-2">(ingevoerd: {group.queried_as})</span>
                )}
              </h2>

              {!group.found ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                  Geen gegevens voor dit nummer. Controleer de code of neem contact op met uw contactpersoon.
                </div>
              ) : (
                <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 list-none p-0 m-0">
                  {group.lines.map((line) => (
                    <LineCard key={`${group.shop_order_key}-${line.case_label}`} line={line} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
        )}
      </div>
    </main>
  )
}
