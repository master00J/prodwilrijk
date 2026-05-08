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
    production_order_no: string | null
  }
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

export default function KlantOrderStatusPage() {
  const [salesOrder, setSalesOrder] = useState('')
  const [shopKey, setShopKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<PortalLine[] | null>(null)
  const [matchedSo, setMatchedSo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLines(null)
    setMatchedSo(null)
    setLoading(true)
    try {
      const res = await fetch('/api/portal/grote-inpak-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrder: salesOrder.trim(),
          shopKey: shopKey.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Opzoeken mislukt')
        return
      }
      setLines(json.lines || [])
      setMatchedSo(json.sales_order || null)
    } catch {
      setError('Netwerkfout. Controleer uw verbinding.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Orderstatus</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Bekijk de voortgang van uw <strong>grote inpak</strong>-order. U heeft het{' '}
          <strong>verkoopordernummer</strong> nodig (zoals op uw orderbevestiging). Optioneel vult u de{' '}
          <strong>6-cijferige code</strong> in (shop-regel / serienummer-suffix) om één specifieke lijn te tonen
          als er meerdere kisten op hetzelfde order staan.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="so" className="block text-sm font-medium text-slate-700 mb-1">
              Verkooporder
            </label>
            <input
              id="so"
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
              placeholder="bv. SO26BE-03109"
              value={salesOrder}
              onChange={(e) => setSalesOrder(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="sk" className="block text-sm font-medium text-slate-700 mb-1">
              6-cijferige code (optioneel)
            </label>
            <input
              id="sk"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
              placeholder="Laat leeg om alle lijnen te tonen"
              value={shopKey}
              onChange={(e) => setShopKey(e.target.value.replace(/\D/g, '').slice(0, 12))}
            />
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

      {lines && lines.length > 0 && (
        <section className="mt-8 space-y-4" aria-label="Resultaten">
          <h2 className="text-lg font-semibold text-slate-800">
            {matchedSo ? `Order ${matchedSo}` : 'Uw order'}
            <span className="font-normal text-slate-500 text-base ml-2">
              ({lines.length} {lines.length === 1 ? 'lijn' : 'lijnen'})
            </span>
          </h2>
          <ul className="space-y-4">
            {lines.map((line) => (
              <li
                key={line.case_label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
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

                {line.progress.detail && (
                  <p className="mt-3 text-sm text-slate-700">{line.progress.detail}</p>
                )}
                {line.progress.production_order_no && (
                  <p className="mt-1 text-xs text-slate-500 font-mono">
                    Productieorder: {line.progress.production_order_no}
                  </p>
                )}

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
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
