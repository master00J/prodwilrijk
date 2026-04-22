'use client'

import { AlertTriangle, ArrowUpRight, Calendar, Medal, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getItemRevenueInRange } from '@/lib/opslag-verhuur/revenue'
import type {
  StorageRentalCustomer,
  StorageRentalItem,
  StorageRentalLocation,
} from '@/types/database'

type Props = {
  customers: StorageRentalCustomer[]
  locations: StorageRentalLocation[]
  items: StorageRentalItem[]
  activeItems: StorageRentalItem[]
  revenuePerCustomer: Map<number, { revenue: number; activeCount: number; totalCount: number }>
  expiringItems: StorageRentalItem[]
  onGoToItems: () => void
  onGoToCustomers: () => void
  onGoToReport: () => void
}

type Period = 3 | 6 | 12 | 24

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

const eurDetail = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function OverviewTab({
  customers,
  items,
  activeItems,
  revenuePerCustomer,
  expiringItems,
  onGoToItems,
  onGoToCustomers,
  onGoToReport,
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<Period>(12)
  const [chartCustomerId, setChartCustomerId] = useState<string>('')

  // Trend opnieuw berekenen op basis van de gekozen filters. Hiermee kun je
  // inzoomen op één klant, of een kortere/langere periode dan 12 maanden zien.
  const filteredTrend = useMemo(() => {
    const now = new Date()
    const relevantItems = chartCustomerId
      ? items.filter((i) => String(i.customer_id) === chartCustomerId)
      : items
    const months: Array<{ key: string; label: string; revenue: number }> = []
    for (let i = chartPeriod - 1; i >= 0; i--) {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const monthEnd = new Date(
        Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)
      )
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )
      const effectiveEnd = monthEnd.getTime() > todayUtc.getTime() ? todayUtc : monthEnd
      const revenue = relevantItems.reduce(
        (sum, item) => sum + getItemRevenueInRange(item, monthDate, effectiveEnd),
        0
      )
      const label = monthDate.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit' })
      const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`
      months.push({ key, label, revenue })
    }
    return months
  }, [items, chartCustomerId, chartPeriod])

  const trendTotal = filteredTrend.reduce((s, m) => s + m.revenue, 0)

  const topCustomers = Array.from(revenuePerCustomer.entries())
    .map(([id, v]) => {
      const c = customers.find((x) => x.id === id)
      return { id, name: c?.name ?? `Klant #${id}`, ...v }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const maxMonthRevenue = Math.max(1, ...filteredTrend.map((m) => m.revenue))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const PERIOD_OPTIONS: Period[] = [3, 6, 12, 24]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Rendement-evolutie */}
      <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Rendement per maand
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Geprorrateerd per dag. Huidige maand loopt tot vandaag.
              {trendTotal > 0 && (
                <>
                  {' '}· Totaal in selectie:{' '}
                  <span className="font-semibold text-emerald-700">{eurDetail(trendTotal)}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToReport}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Naar rapport <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Periode</label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setChartPeriod(opt)}
                  className={`px-2.5 py-1 font-medium transition-colors ${
                    chartPeriod === opt
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt}M
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Klant</label>
            <select
              value={chartCustomerId}
              onChange={(e) => setChartCustomerId(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white min-w-[160px]"
            >
              <option value="">Alle klanten</option>
              {customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {filteredTrend.every((m) => m.revenue === 0) ? (
          <p className="text-sm text-gray-400 text-center py-12">
            Geen rendement in deze selectie.
          </p>
        ) : (
          <div>
            {/* Chart area: iedere kolom is h-full en lijnt naar onder uit */}
            <div className="flex items-end gap-1.5 h-40 border-b border-gray-100 pb-0.5">
              {filteredTrend.map((m, i) => {
                const heightPct =
                  maxMonthRevenue > 0 ? (m.revenue / maxMonthRevenue) * 100 : 0
                const isLast = i === filteredTrend.length - 1
                return (
                  <div
                    key={m.key}
                    className="flex-1 h-full flex flex-col justify-end items-center relative group"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isLast
                          ? 'bg-emerald-500 group-hover:bg-emerald-600'
                          : 'bg-emerald-200 group-hover:bg-emerald-400'
                      }`}
                      style={{ height: `${Math.max(heightPct, m.revenue > 0 ? 2 : 0)}%` }}
                      title={`${m.label}: ${eurDetail(m.revenue)}`}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap bg-gray-900 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {eur(m.revenue)}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* X-as labels */}
            <div className="flex gap-1.5 mt-1.5">
              {filteredTrend.map((m) => (
                <div
                  key={m.key}
                  className="flex-1 text-[10px] text-gray-500 text-center whitespace-nowrap capitalize"
                  title={m.label}
                >
                  {m.label.replace('.', '')}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Top-5 klanten */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" />
            Top-5 klanten (rendement)
          </h3>
          <button
            type="button"
            onClick={onGoToCustomers}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Alle <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {topCustomers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            Nog geen klant-omzet.
          </p>
        ) : (
          <ul className="space-y-2">
            {topCustomers.map((c, idx) => {
              const topRev = topCustomers[0].revenue
              const pct = topRev > 0 ? (c.revenue / topRev) * 100 : 0
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <span className="truncate text-gray-900" title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    <span className="tabular-nums text-emerald-700 font-medium">
                      {eur(c.revenue)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {c.activeCount} actief · {c.totalCount} totaal
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Opslagen die binnen 30 dagen verlopen */}
      <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Verlopen binnen 30 dagen
          </h3>
          <span className="text-xs text-gray-500">
            {expiringItems.length} opslag{expiringItems.length === 1 ? '' : 'en'}
          </span>
        </div>
        {expiringItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Geen actieve opslagen met einddatum binnen 30 dagen.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-1">
            {expiringItems.slice(0, 8).map((item) => {
              const end = item.end_date ? new Date(item.end_date) : null
              const diffDays = end
                ? Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
                : 0
              const urgent = diffDays <= 7
              return (
                <div
                  key={item.id}
                  className="px-1 py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {item.customer?.name ||
                        customers.find((c) => c.id === item.customer_id)?.name ||
                        '—'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {[item.or_number, item.description, item.foresco_id].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div
                    className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded ${
                      urgent
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {diffDays <= 0
                      ? 'Vandaag'
                      : `Over ${diffDays} d · ${end?.toLocaleDateString('nl-BE')}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Mini stats */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-indigo-500" />
          In één oogopslag
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Opslagen actief</dt>
            <dd className="tabular-nums font-medium text-gray-900">{activeItems.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Opslagen gestopt</dt>
            <dd className="tabular-nums font-medium text-gray-900">
              {items.length - activeItems.length}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Klanten (actief)</dt>
            <dd className="tabular-nums font-medium text-gray-900">
              {customers.filter((c) => c.active !== false).length}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Verpakt vs bare</dt>
            <dd className="tabular-nums font-medium text-gray-900">
              {activeItems.filter((i) => i.packing_status === 'verpakt').length}
              <span className="text-gray-400"> / </span>
              {activeItems.filter((i) => i.packing_status !== 'verpakt').length}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onGoToItems}
          className="mt-4 w-full px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Beheer opslagen
        </button>
      </section>
    </div>
  )
}
