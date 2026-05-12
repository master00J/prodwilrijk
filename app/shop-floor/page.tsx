'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE, SITES, type Site } from '@/lib/sites'
import { useAuth } from '@/components/AuthProvider'

type OrderStatus = 'not_started' | 'in_progress' | 'partial' | 'completed'

interface ShopFloorLine {
  id: number
  lineNo: number | null
  itemNumber: string
  description: string
  requiredQty: number
  completedQty: number
  remainingQty: number
  progress: number
  status: OrderStatus
  activeLogs: Array<{
    id: number
    employeeName: string
    step: string
    startTime: string
    elapsedSeconds: number
  }>
}

interface ShopFloorOrder {
  orderNumber: string
  salesOrderNumber: string | null
  uploadedAt: string
  status: OrderStatus
  requiredQty: number
  completedQty: number
  remainingQty: number
  progress: number
  activeEmployees: string[]
  site?: string | null
  lines: ShopFloorLine[]
}

interface ShopFloorResponse {
  orders: ShopFloorOrder[]
  summary: {
    total: number
    inProgress: number
    partial: number
    notStarted: number
    completed: number
  }
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  not_started: 'Niet gestart',
  in_progress: 'Bezig',
  partial: 'Deels klaar',
  completed: 'Klaar',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}u ${m}m`
  return `${m}m`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ShopFloorPage() {
  const { allowedSites } = useAuth()
  const availableSites = useMemo(
    () => allowedSites.length > 0 ? SITES.filter(siteOption => allowedSites.includes(siteOption)) : [...SITES],
    [allowedSites]
  )
  const [data, setData] = useState<ShopFloorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [site, setSite] = useState<Site>(DEFAULT_SITE)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(site)) {
      setSite(availableSites[0])
    }
  }, [availableSites, site])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('site', site)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/shop-floor/production-orders?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Shop-floor data laden mislukt')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Shop-floor data laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [search, site])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => void load(), 30000)
    return () => clearInterval(timer)
  }, [load])

  const filteredOrders = useMemo(() => {
    const orders = data?.orders || []
    if (statusFilter === 'all') return orders
    return orders.filter(order => order.status === statusFilter)
  }, [data?.orders, statusFilter])

  const summary = data?.summary

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="w-full max-w-none px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Shop floor</p>
            <h1 className="text-3xl font-bold text-slate-900">Productieorders op de vloer</h1>
            <p className="mt-1 text-sm text-slate-600">
              Live overzicht van actieve productieorders, voortgang, tijdregistraties en open aantallen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shop-floor/planning"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Productieplanning
            </Link>
            <Link
              href="/admin/production-order-upload"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Upload BC data
            </Link>
            <Link
              href="/production-order-time"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Tijd registreren
            </Link>
          </div>
        </div>

        {summary && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryCard label="Open orders" value={summary.total} />
            <SummaryCard label="Bezig" value={summary.inProgress} accent="emerald" />
            <SummaryCard label="Deels klaar" value={summary.partial} accent="amber" />
            <SummaryCard label="Niet gestart" value={summary.notStarted} accent="slate" />
            <SummaryCard label="Klaar" value={summary.completed} accent="blue" />
          </div>
        )}

        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 md:max-w-2xl md:flex-row">
              <select
                value={site}
                onChange={(e) => setSite(e.target.value as Site)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {availableSites.map(siteOption => (
                  <option key={siteOption} value={siteOption}>{siteOption}</option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek op productieorder of sales order..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'in_progress', 'partial', 'not_started', 'completed'] as const).map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status === 'all' ? 'Alles' : STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Shop-floor data laden...
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Geen open productieorders gevonden.
          </div>
        )}

        <div className="space-y-4">
          {filteredOrders.map(order => (
            <OrderCard key={`${order.site || site}-${order.orderNumber}`} order={order} />
          ))}
        </div>
      </div>
    </main>
  )
}

function SummaryCard({ label, value, accent = 'slate' }: { label: string; value: number; accent?: 'slate' | 'emerald' | 'amber' | 'blue' }) {
  const colors = {
    slate: 'border-slate-200 text-slate-900',
    emerald: 'border-emerald-200 text-emerald-700',
    amber: 'border-amber-200 text-amber-700',
    blue: 'border-blue-200 text-blue-700',
  }

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${colors[accent]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

function OrderCard({ order }: { order: ShopFloorOrder }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{order.orderNumber}</h2>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>Sales order: {order.salesOrderNumber || '-'}</span>
              <span>Upload: {formatDate(order.uploadedAt)}</span>
              <span>{order.completedQty}/{order.requiredQty} stuks klaar</span>
            </div>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
              <span>Ordervoortgang</span>
              <span>{order.progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${order.progress}%` }} />
            </div>
          </div>
        </div>

        {order.activeEmployees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {order.activeEmployees.map(employee => (
              <span key={employee} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Nu bezig: {employee}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {order.lines.map(line => (
          <div key={line.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_160px_220px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {line.itemNumber ? <BcItemCode value={line.itemNumber} /> : 'Geen itemnummer'}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[line.status]}`}>
                  {STATUS_LABELS[line.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{line.description || '-'}</p>
              {line.activeLogs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {line.activeLogs.map(log => (
                    <span key={log.id} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                      {log.employeeName} · {log.step} · {formatElapsed(log.elapsedSeconds)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-sm text-slate-700">
              <div><strong>{line.completedQty}</strong> klaar</div>
              <div>{line.remainingQty} open van {line.requiredQty}</div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                <span>Regelvoortgang</span>
                <span>{line.progress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${line.progress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
