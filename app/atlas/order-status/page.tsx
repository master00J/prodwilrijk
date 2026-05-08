'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Printer, Search } from 'lucide-react'

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
  customer_order_no: string | null
  shop_key: string | null
  serial_number: string | null
  progress: {
    headline: string
    detail: string | null
    production_step: string | null
  }
}

const STATUS_FILTER_OPTIONS = [
  { value: 'Alle', label: 'Alle statussen' },
  { value: 'In productie op de vloer', label: 'In productie (vloer)' },
  { value: 'In ons magazijn (Willebroek)', label: 'Magazijn Willebroek' },
  { value: 'In voorbereiding (Genk)', label: 'Voorbereiding Genk' },
  { value: 'In voorbereiding (Wilrijk)', label: 'Voorbereiding Wilrijk' },
  { value: 'Order geregistreerd', label: 'Order geregistreerd' },
] as const

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

function headlineBadgeClass(headline: string): string {
  if (headline.includes('vloer')) return 'bg-amber-100 text-amber-950 border-amber-300/80'
  if (headline.includes('magazijn')) return 'bg-emerald-100 text-emerald-950 border-emerald-300/80'
  if (headline.includes('Genk')) return 'bg-sky-100 text-sky-950 border-sky-300/80'
  if (headline.includes('Wilrijk')) return 'bg-violet-100 text-violet-950 border-violet-300/80'
  return 'bg-slate-100 text-slate-800 border-slate-300/80'
}

export default function AtlasOrderStatusPage() {
  const [kist, setKist] = useState('')
  const [status, setStatus] = useState<string>('Alle')
  const [order, setOrder] = useState('')
  const [item, setItem] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [lines, setLines] = useState<PortalLine[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [advOpen, setAdvOpen] = useState(false)
  const [shopOrdersInput, setShopOrdersInput] = useState('')
  const [advLoading, setAdvLoading] = useState(false)
  const [advError, setAdvError] = useState<string | null>(null)
  const [advGroups, setAdvGroups] = useState<
    { shop_order_key: string; queried_as: string; found: boolean; lines: PortalLine[] }[] | null
  >(null)

  const fetchList = useCallback(
    async (pageOverride?: number) => {
      setLoading(true)
      setError(null)
      try {
        const effectivePage = pageOverride ?? page
        const q = new URLSearchParams()
        q.set('page', String(effectivePage))
        q.set('pageSize', String(pageSize))
        if (kist.trim()) q.set('kist', kist.trim())
        if (order.trim()) q.set('order', order.trim())
        if (item.trim()) q.set('item', item.trim())
        if (status && status !== 'Alle') q.set('status', status)

        const res = await fetch(`/api/portal/grote-inpak-list?${q.toString()}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Laden mislukt')
          setLines([])
          setTotal(0)
          return
        }
        setLines(json.lines || [])
        setTotal(typeof json.total === 'number' ? json.total : 0)
        setTruncated(Boolean(json.truncated))
      } catch {
        setError('Netwerkfout. Controleer uw verbinding.')
        setLines([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [page, kist, status, order, item, pageSize],
  )

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const submitFilters = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void fetchList(1)
  }

  const clearFilters = () => {
    setKist('')
    setStatus('Alle')
    setOrder('')
    setItem('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const submitAdvanced = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdvError(null)
    setAdvGroups(null)
    setAdvLoading(true)
    try {
      const res = await fetch('/api/portal/grote-inpak-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopOrder: shopOrdersInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAdvError(json.error || 'Opzoeken mislukt')
        return
      }
      setAdvGroups(json.results || [])
    } catch {
      setAdvError('Netwerkfout. Controleer uw verbinding.')
    } finally {
      setAdvLoading(false)
    }
  }

  const printTable = () => window.print()

  return (
    <div className="min-h-screen bg-[#e6eef8] text-slate-900 antialiased print:bg-white">
      <header className="border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#153d75] text-white shadow-md print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-white/20 bg-white/10 text-sm font-bold">
              GI
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">Atlas Copco</p>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Orderstatus — PILS (grote inpak)</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-sky-100/95">
            <span>
              {new Date().toLocaleString('nl-BE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <button
              type="button"
              onClick={printTable}
              className="ml-2 inline-flex items-center gap-1 rounded border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Afdrukken
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
        <section className="mb-4 rounded border border-slate-300/80 bg-white px-4 py-4 shadow-sm print:hidden">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Zoek op</p>
          <form onSubmit={submitFilters} className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="f-kist" className="mb-1 block text-xs font-medium text-slate-600">
                  Kist / label
                </label>
                <input
                  id="f-kist"
                  autoComplete="off"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
                  value={kist}
                  onChange={(e) => setKist(e.target.value)}
                  placeholder="bv. FD60F"
                />
              </div>
              <div>
                <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-slate-600">
                  Status
                </label>
                <select
                  id="f-status"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-order" className="mb-1 block text-xs font-medium text-slate-600">
                  Order (shop / key / cust.)
                </label>
                <input
                  id="f-order"
                  autoComplete="off"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  placeholder="BC shop order, shop-key of customer order"
                />
              </div>
              <div>
                <label htmlFor="f-item" className="mb-1 block text-xs font-medium text-slate-600">
                  Item / serial
                </label>
                <input
                  id="f-item"
                  autoComplete="off"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="BC FP of serienummer"
                />
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded bg-[#1a4b8c] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#153d75]"
              >
                <Search className="h-4 w-4" aria-hidden />
                Zoek
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Wis
              </button>
            </div>
          </form>
        </section>

        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between print:hidden">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{total}</span> resultaten
            {total > 0 ? (
              <>
                , toon <span className="font-medium">{from}</span> t/m{' '}
                <span className="font-medium">{to}</span>
              </>
            ) : null}
            {truncated ? (
              <span className="ml-2 text-amber-800">
                (max. 3000 rijen geladen — verfijn zoekvelden indien u iets mist)
              </span>
            ) : null}
          </p>
          {total > pageSize ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Vorige pagina"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm text-slate-600">
                Pagina {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Volgende pagina"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded border border-slate-300 bg-white py-16 text-slate-600 print:hidden">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Laden…
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-400/90 shadow-md">
            <table className="min-w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr className="border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#17487a] text-left text-white">
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Status</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Kist / label</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Type</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">PILS-datum</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Deadline</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Order ref.</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Customer order</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Shop-key</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Item (FP)</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Serial</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Locatie</th>
                  <th className="min-w-[12rem] px-3 py-3 font-semibold">Omschrijving</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr className="bg-white">
                    <td colSpan={12} className="px-3 py-10 text-center text-slate-500">
                      Geen regels in deze selectie. Pas de filters aan of wis de velden.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr
                      key={`${line.case_label}-${line.shop_key}-${idx}`}
                      className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-[#f0f6fc]' : 'bg-white'}`}
                    >
                      <td className="align-top px-3 py-2">
                        <span
                          className={`inline-block max-w-[11rem] rounded border px-2 py-1 text-xs font-semibold leading-snug ${headlineBadgeClass(line.progress.headline)}`}
                        >
                          {line.progress.headline}
                        </span>
                        {line.progress.detail ? (
                          <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-slate-600">{line.progress.detail}</p>
                        ) : null}
                        {line.days_overdue > 0 ? (
                          <p className="mt-1 text-[11px] font-medium text-rose-700">
                            {line.days_overdue} wd. na deadline
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{line.case_label}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-800">{line.case_type || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-800">
                        {formatNlDate(line.arrival_indicative)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-800">{formatNlDate(line.deadline)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{line.shop_reference || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{line.customer_order_no || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{line.shop_key || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">{line.fp_code || '—'}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-slate-700" title={line.serial_number || undefined}>
                        {line.serial_number || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-800">
                        {line.in_willebroek ? 'Willebroek (WMS)' : line.productielocatie || '—'}
                      </td>
                      <td className="max-w-[20rem] px-3 py-2 text-slate-700">{line.description || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-8 rounded border border-slate-300/80 bg-white p-4 shadow-sm print:hidden">
          <button
            type="button"
            onClick={() => setAdvOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-800"
          >
            Geavanceerd: opzoeken op lijst shoporders
            <span className="text-slate-400">{advOpen ? '▼' : '▶'}</span>
          </button>
          {advOpen ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">
                Tot 35 nummers tegelijk (nieuwe regel, komma of puntkomma). Alleen passende regels worden getoond.
              </p>
              <form onSubmit={submitAdvanced} className="mt-3 space-y-3">
                <textarea
                  rows={4}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                  value={shopOrdersInput}
                  onChange={(e) => setShopOrdersInput(e.target.value)}
                  placeholder={'941001&#10;941002'}
                />
                <button
                  type="submit"
                  disabled={advLoading}
                  className="inline-flex items-center gap-2 rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {advLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Zoek shoporders
                </button>
              </form>
              {advError ? <p className="mt-2 text-sm text-amber-800">{advError}</p> : null}
              {advGroups && advGroups.length > 0 ? (
                <ul className="mt-4 list-none space-y-4 p-0">
                  {advGroups.map((g) => (
                    <li key={g.shop_order_key} className="rounded border border-slate-200 bg-slate-50/80 p-3">
                      <p className="font-mono text-sm font-semibold">{g.shop_order_key}</p>
                      {!g.found ? (
                        <p className="text-sm text-amber-800">Geen gegevens voor dit nummer.</p>
                      ) : (
                        <p className="text-sm text-slate-600">{g.lines.length} lijn(en)</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="mt-10 border-t border-slate-300/80 pt-6 text-center text-xs text-slate-600 print:mt-4">
          Indicatieve status — geen rechten kunnen worden ontleend aan dit overzicht.
        </footer>
      </main>
    </div>
  )
}
