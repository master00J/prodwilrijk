'use client'

import { AlertTriangle, ArrowUpRight, Calendar, Medal, TrendingUp } from 'lucide-react'
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
  monthlyRevenueTrend: Array<{ key: string; label: string; revenue: number }>
  expiringItems: StorageRentalItem[]
  onGoToItems: () => void
  onGoToCustomers: () => void
  onGoToReport: () => void
}

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

const eurDetail = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function OverviewTab({
  customers,
  items,
  activeItems,
  revenuePerCustomer,
  monthlyRevenueTrend,
  expiringItems,
  onGoToItems,
  onGoToCustomers,
  onGoToReport,
}: Props) {
  const topCustomers = Array.from(revenuePerCustomer.entries())
    .map(([id, v]) => {
      const c = customers.find((x) => x.id === id)
      return { id, name: c?.name ?? `Klant #${id}`, ...v }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const maxMonthRevenue = Math.max(1, ...monthlyRevenueTrend.map((m) => m.revenue))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Rendement-evolutie */}
      <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Rendement per maand (laatste 12 maanden)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Geprorrateerd per dag. Huidige maand loopt tot vandaag.
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
        {monthlyRevenueTrend.every((m) => m.revenue === 0) ? (
          <p className="text-sm text-gray-400 text-center py-12">
            Nog geen rendement-data in de laatste 12 maanden.
          </p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {monthlyRevenueTrend.map((m, i) => {
              const heightPct = (m.revenue / maxMonthRevenue) * 100
              const isLast = i === monthlyRevenueTrend.length - 1
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="relative w-full flex items-end justify-center"
                    style={{ height: '100%' }}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isLast
                          ? 'bg-emerald-500 group-hover:bg-emerald-600'
                          : 'bg-emerald-200 group-hover:bg-emerald-300'
                      }`}
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                      title={`${m.label}: ${eurDetail(m.revenue)}`}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap bg-gray-900 text-white px-1.5 py-0.5 rounded pointer-events-none">
                      {eur(m.revenue)}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 capitalize whitespace-nowrap">
                    {m.label.replace('.', '')}
                  </div>
                </div>
              )
            })}
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
