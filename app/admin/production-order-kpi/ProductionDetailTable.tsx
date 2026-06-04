'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, FileDown, User } from 'lucide-react'
import * as XLSX from 'xlsx'
import { BcItemCode } from '@/lib/bc-mapping/client'
import type { DetailSortKey, RevenueRun } from './types'
import {
  formatDate,
  formatEuro,
  formatEuroCompact,
  formatHours,
  formatPct,
  intFormatter,
  marginColorClass,
  marginPct,
  revPerHour,
} from './kpi-formatters'

function SortHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: DetailSortKey
  activeKey: DetailSortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: DetailSortKey) => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`py-3 pr-4 font-medium cursor-pointer select-none whitespace-nowrap ${
        align === 'right' ? 'text-right' : ''
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
        {label}
        {activeKey === sortKey ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <span className="w-3 h-3 opacity-0">·</span>
        )}
      </span>
    </th>
  )
}

export function ProductionDetailTable({
  runs,
  loading,
  dateFrom,
  dateTo,
}: {
  runs: RevenueRun[]
  loading: boolean
  dateFrom: string
  dateTo: string
}) {
  const [search, setSearch] = useState('')
  const [expandedRunKey, setExpandedRunKey] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<DetailSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: DetailSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? runs.filter(
          (r) =>
            (r.item_number || '').toLowerCase().includes(q) ||
            (r.order_number || '').toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q)
        )
      : runs

    const dir = sortDir === 'asc' ? 1 : -1
    const keyFn = (r: RevenueRun): number | string => {
      switch (sortKey) {
        case 'date':
          return r.date
        case 'hours':
          return r.hours ?? 0
        case 'revenue':
          return r.revenue ?? -Infinity
        case 'margin':
          return r.margin ?? -Infinity
        case 'margin_pct':
          return marginPct(r.revenue, r.margin) ?? -Infinity
        case 'rev_per_hour':
          return revPerHour(r.revenue, r.hours) ?? -Infinity
        case 'quantity':
          return r.quantity ?? 0
      }
    }

    return [...base].sort((a, b) => {
      const av = keyFn(a)
      const bv = keyFn(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [runs, search, sortKey, sortDir])

  const exportToExcel = () => {
    if (filteredRuns.length === 0) {
      alert('Geen data om te exporteren.')
      return
    }
    const rows = filteredRuns.map((r) => {
      const mPct = marginPct(r.revenue, r.margin)
      const rph = revPerHour(r.revenue, r.hours)
      return {
        Datum: formatDate(r.date),
        Order: r.order_number,
        Item: r.item_number,
        Omschrijving: r.description || '',
        Stuks: r.quantity,
        'Verkoopprijs €': r.sales_price ?? '',
        'Opbrengst €': r.revenue ?? '',
        'Materiaalkost €': r.material_cost_total,
        Uren: Math.round(r.hours * 100) / 100,
        'Marge €': r.margin ?? '',
        'Marge %': mPct != null ? Math.round(mPct * 10) / 10 : '',
        '€ per uur': rph != null ? Math.round(rph * 100) / 100 : '',
        'Uren/stuk': r.hours_per_piece,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productie')
    XLSX.writeFile(wb, `productie-kpi_${dateFrom || 'vanaf'}_${dateTo || 'tot'}.xlsx`)
  }

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Detail per productie</h2>
          <p className="text-sm text-gray-500">{filteredRuns.length} runs in selectie</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Zoek op item, order of omschrijving..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-72"
          />
          <button
            type="button"
            onClick={exportToExcel}
            disabled={filteredRuns.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 py-12 text-center">Data laden...</p>
      ) : filteredRuns.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">Geen productiedata in de geselecteerde periode.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 px-4 w-8" />
                <SortHeader
                  label="Datum"
                  sortKey="date"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <th className="py-3 pr-4 font-medium">Order</th>
                <th className="py-3 pr-4 font-medium">Item</th>
                <th className="py-3 pr-4 font-medium">Omschrijving</th>
                <SortHeader
                  label="Stuks"
                  sortKey="quantity"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <SortHeader
                  label="Opbrengst"
                  sortKey="revenue"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <th className="py-3 pr-4 font-medium text-right whitespace-nowrap">Materiaal</th>
                <SortHeader
                  label="Uren"
                  sortKey="hours"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <SortHeader
                  label="Marge €"
                  sortKey="margin"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <SortHeader
                  label="Marge %"
                  sortKey="margin_pct"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
                <SortHeader
                  label="€ / uur"
                  sortKey="rev_per_hour"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((r, idx) => {
                const runKey = `${r.order_number}-${r.item_number}-${r.date}-${idx}`
                const isExpanded = expandedRunKey === runKey
                const steps = r.steps ?? []
                const employees = r.employees ?? []
                const hasDetails = steps.length > 0 || employees.length > 0
                const mPct = marginPct(r.revenue, r.margin)
                const rph = revPerHour(r.revenue, r.hours)
                return (
                  <React.Fragment key={runKey}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="py-2 px-4">
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() => setExpandedRunKey(isExpanded ? null : runKey)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-200"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span className="inline-block w-6 text-gray-300">–</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">{r.order_number}</td>
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">
                        <BcItemCode value={r.item_number} />
                      </td>
                      <td
                        className="py-2 pr-4 max-w-[220px] truncate text-gray-600"
                        title={r.description || ''}
                      >
                        {r.description || '–'}
                      </td>
                      <td className="py-2 pr-4 text-right">{intFormatter.format(r.quantity)}</td>
                      <td className="py-2 pr-4 text-right font-medium whitespace-nowrap">
                        {formatEuro(r.revenue)}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap text-gray-600">
                        {formatEuroCompact(r.material_cost_total)}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">{formatHours(r.hours)}</td>
                      <td
                        className={`py-2 pr-4 text-right whitespace-nowrap ${marginColorClass(mPct)}`}
                      >
                        {formatEuro(r.margin)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right whitespace-nowrap ${marginColorClass(mPct)}`}
                      >
                        {formatPct(mPct)}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap text-gray-700">
                        {rph != null ? formatEuro(rph) : '–'}
                      </td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-slate-50 border-b border-gray-100">
                        <td />
                        <td colSpan={11} className="py-3 px-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {steps.length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">Uren per stap</div>
                                <div className="flex flex-wrap gap-2">
                                  {steps.map((s) => (
                                    <span
                                      key={s.step}
                                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
                                    >
                                      <span className="text-gray-700">{s.step}</span>
                                      <span className="font-medium">{formatHours(s.hours)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {employees.length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">Medewerkers</div>
                                <div className="flex flex-wrap gap-2">
                                  {employees.map((e) => (
                                    <span
                                      key={e.employee_name}
                                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
                                    >
                                      <User className="h-4 w-4 text-gray-400" />
                                      <span>{e.employee_name}</span>
                                      <span className="font-medium">{formatHours(e.hours)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
