'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload, RefreshCw, AlertCircle, CheckCircle2, Factory, Clock, CalendarDays, Package } from 'lucide-react'
import { BcItemCode } from '@/lib/bc-mapping/client'

interface ProductionOrder {
  id: number
  status: string | null
  prod_order_no: string
  item_no: string
  description: string | null
  location_code: string | null
  productielocatie: 'Genk' | 'Wilrijk' | 'Willebroek' | null
  kistnummer: string | null
  quantity: number | null
  finished_quantity: number | null
  remaining_quantity: number | null
  due_date: string | null
  starting_date: string | null
  ending_date: string | null
  source_file: string | null
  uploaded_at: string
}

interface Stats {
  total: number
  open: number
  te_laat: number
  deze_week: number
  remaining_total: number
  per_locatie: Record<'Genk' | 'Wilrijk' | 'Willebroek', { count: number; remaining: number }>
}

type LocationFilter = 'all' | 'Genk' | 'Wilrijk' | 'Willebroek'

function formatDate(s: string | null): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return Number(n).toLocaleString('nl-BE')
}

export default function ProductieOrdersTab() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/grote-inpak/production-orders', { cache: 'no-store' })
      if (!res.ok) throw new Error('Laden mislukt')
      const json = await res.json()
      setOrders(json.data || [])
      setStats(json.stats || null)
    } catch (err: any) {
      setError(err.message || 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    setSuccess(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/grote-inpak/production-orders/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload mislukt')
      const parts: string[] = [
        `${json.ingevoegd} productie-orderlijnen geïmporteerd`,
      ]
      if (json.overgeslagen_locatie) parts.push(`${json.overgeslagen_locatie} rijen buiten Genk/Wilrijk/Willebroek genegeerd`)
      if (json.overgeslagen_niet_in_erp) parts.push(`${json.overgeslagen_niet_in_erp} rijen niet in ERP LINK`)
      setSuccess(parts.join(' · '))
      await load()
    } catch (err: any) {
      setError(err.message || 'Upload mislukt')
    } finally {
      setUploading(false)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter(o => {
      if (onlyOpen && Number(o.remaining_quantity ?? 0) <= 0) return false
      if (locationFilter !== 'all' && o.productielocatie !== locationFilter) return false
      if (term) {
        const hay = `${o.prod_order_no} ${o.item_no} ${o.description ?? ''} ${o.kistnummer ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [orders, onlyOpen, locationFilter, search])

  const now = Date.now()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            Productie-orders (BC)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload de <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Prod. Order Line List</code> export uit Business Central.
            Alleen lijnen voor <strong>Genk (GENK_EIK)</strong>, <strong>Wilrijk</strong> en <strong>Willebroek</strong> én met een match in de ERP LINK worden opgeslagen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="text-sm font-medium">{uploading ? 'Uploaden...' : 'Upload Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
                e.target.value = ''
              }}
            />
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-green-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Totaal open"
            value={stats.open}
            sub={`${formatNumber(stats.remaining_total)} stuks`}
            color="blue"
            icon={<Package className="w-5 h-5" />}
          />
          <KpiCard
            label="Te laat"
            value={stats.te_laat}
            sub="einddatum voorbij"
            color={stats.te_laat > 0 ? 'red' : 'gray'}
            icon={<Clock className="w-5 h-5" />}
          />
          <KpiCard
            label="Deze week af"
            value={stats.deze_week}
            sub="eindigt < 7 dagen"
            color="amber"
            icon={<CalendarDays className="w-5 h-5" />}
          />
          <KpiCard
            label="Genk"
            value={stats.per_locatie.Genk.count}
            sub={`${formatNumber(stats.per_locatie.Genk.remaining)} stuks`}
            color="purple"
          />
          <KpiCard
            label="Wilrijk + Willebroek"
            value={stats.per_locatie.Wilrijk.count + stats.per_locatie.Willebroek.count}
            sub={`${formatNumber(stats.per_locatie.Wilrijk.remaining + stats.per_locatie.Willebroek.remaining)} stuks`}
            color="indigo"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'Genk', 'Wilrijk', 'Willebroek'] as LocationFilter[]).map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                locationFilter === loc ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {loc === 'all' ? 'Alle locaties' : loc}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Enkel openstaande (remaining &gt; 0)</span>
        </label>
        <input
          type="text"
          placeholder="Zoek op PO-nr, item, kist, omschrijving..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <span className="text-gray-500 text-xs whitespace-nowrap">{filtered.length} / {orders.length} rijen</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Kist</th>
              <th className="px-3 py-2 text-left">PO nr.</th>
              <th className="px-3 py-2 text-left">Item (BC)</th>
              <th className="px-3 py-2 text-left">Omschrijving</th>
              <th className="px-3 py-2 text-left">Locatie</th>
              <th className="px-3 py-2 text-right">Aantal</th>
              <th className="px-3 py-2 text-right">Afgewerkt</th>
              <th className="px-3 py-2 text-right">Resterend</th>
              <th className="px-3 py-2 text-left">Einddatum</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">Laden...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                Geen productie-orders. Upload een <em>Prod. Order Line List</em> Excel om te starten.
              </td></tr>
            )}
            {filtered.map(o => {
              const overdue = o.ending_date && Number(o.remaining_quantity ?? 0) > 0 && new Date(o.ending_date).getTime() < now
              return (
                <tr key={o.id} className="hover:bg-blue-50/30">
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900">{o.kistnummer ?? '-'}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{o.prod_order_no}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">
                    <BcItemCode value={o.item_no} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[260px] truncate" title={o.description ?? ''}>{o.description ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      o.productielocatie === 'Genk' ? 'bg-purple-100 text-purple-700'
                      : o.productielocatie === 'Wilrijk' ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                    }`}>{o.productielocatie}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(o.quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{formatNumber(o.finished_quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNumber(o.remaining_quantity)}</td>
                  <td className={`px-3 py-2 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>{formatDate(o.ending_date)}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{o.status ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string
  value: number
  sub?: string
  color: 'blue' | 'red' | 'amber' | 'purple' | 'indigo' | 'gray'
  icon?: React.ReactNode
}) {
  const palette: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className={`border rounded-lg p-3 ${palette[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString('nl-BE')}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}
