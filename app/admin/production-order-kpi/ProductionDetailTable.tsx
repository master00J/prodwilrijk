'use client'

import React, { useMemo, useState } from 'react'
import { FileDown, User } from 'lucide-react'
import * as XLSX from 'xlsx'
import { BcItemCode } from '@/lib/bc-mapping/client'
import type { RevenueRun } from './types'
import { formatDate, formatHours } from './kpi-formatters'

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

  const filteredRuns = useMemo(() => {
    if (!search.trim()) return runs
    const q = search.toLowerCase()
    return runs.filter(
      (r) =>
        (r.item_number || '').toLowerCase().includes(q) ||
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    )
  }, [runs, search])

  const exportToExcel = () => {
    if (filteredRuns.length === 0) {
      alert('Geen data om te exporteren.')
      return
    }
    const rows = filteredRuns.map((r) => ({
      Datum: formatDate(r.date),
      Order: r.order_number,
      Item: r.item_number,
      Omschrijving: r.description || '',
      Stuks: r.quantity,
      'Uren (decimaal)': Math.round(r.hours * 100) / 100,
      'Uren/stuk': r.hours_per_piece,
    }))
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
        <p className="text-gray-500 py-12 text-center">
          Geen productiedata in de geselecteerde periode.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 px-4 w-8" />
                <th className="py-3 pr-4 font-medium">Datum</th>
                <th className="py-3 pr-4 font-medium">Order</th>
                <th className="py-3 pr-4 font-medium">Item</th>
                <th className="py-3 pr-4 font-medium">Omschrijving</th>
                <th className="py-3 pr-4 font-medium text-right">Stuks</th>
                <th className="py-3 pr-4 font-medium text-right">Uren/stuk</th>
                <th className="py-3 pr-4 font-medium text-right">Uren</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((r, idx) => {
                const runKey = `${r.order_number}-${r.item_number}-${r.date}-${idx}`
                const isExpanded = expandedRunKey === runKey
                const steps = r.steps ?? []
                const employees = r.employees ?? []
                const hasDetails = steps.length > 0 || employees.length > 0
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
                      <td className="py-2 pr-4 font-medium">{r.order_number}</td>
                      <td className="py-2 pr-4 font-medium">
                        <BcItemCode value={r.item_number} />
                      </td>
                      <td className="py-2 pr-4 max-w-[220px] truncate text-gray-600" title={r.description || ''}>
                        {r.description || '–'}
                      </td>
                      <td className="py-2 pr-4 text-right">{r.quantity}</td>
                      <td className="py-2 pr-4 text-right">{formatHours(r.hours_per_piece)}</td>
                      <td className="py-2 pr-4 text-right">{formatHours(r.hours)}</td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-slate-50 border-b border-gray-100">
                        <td />
                        <td colSpan={7} className="py-3 px-4">
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
