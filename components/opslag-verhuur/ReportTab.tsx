'use client'

import { Download, RotateCcw, Users } from 'lucide-react'
import type { ReportRow, ReportSummaryResult } from '@/app/opslag-verhuur/useStorageRentals'
import type { StorageRentalCustomer } from '@/types/database'

type Props = {
  customers: StorageRentalCustomer[]
  reportCustomerIds: string[]
  setReportCustomerIds: (ids: string[]) => void
  reportOrSearch: string
  setReportOrSearch: (s: string) => void
  reportStartDate: string
  setReportStartDate: (s: string) => void
  reportEndDate: string
  setReportEndDate: (s: string) => void
  reportSummary: ReportSummaryResult | null
  handleExportReportExcel: () => void
}

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function ReportTab({
  customers,
  reportCustomerIds,
  setReportCustomerIds,
  reportOrSearch,
  setReportOrSearch,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  reportSummary,
  handleExportReportExcel,
}: Props) {
  const canReset =
    reportCustomerIds.length > 0 || reportOrSearch || reportStartDate || reportEndDate

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Klant rapport</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportCustomerIds(customers.map((c) => String(c.id)))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Users className="w-3.5 h-3.5" />
              Alle klanten
            </button>
            <button
              type="button"
              onClick={() => {
                setReportCustomerIds([])
                setReportOrSearch('')
                setReportStartDate('')
                setReportEndDate('')
              }}
              disabled={!canReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Klant ({reportCustomerIds.length || 'alle'})
            </label>
            <select
              multiple
              value={reportCustomerIds}
              onChange={(e) =>
                setReportCustomerIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[140px]"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Geen selectie = alle klanten. Ctrl/⌘ klikken voor multi-select.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Zoek OR / Omschrijving / Foresco ID
              </label>
              <input
                type="text"
                value={reportOrSearch}
                onChange={(e) => setReportOrSearch(e.target.value)}
                placeholder="Filter binnen selectie"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Startdatum</label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Einddatum</label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Vul optioneel een periode in. Leeg = van 1 jaar geleden tot vandaag.
            </p>
          </div>
        </div>
      </div>

      {/* Resultaat */}
      {!reportSummary ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-500">
          <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          Selecteer minstens één klant om een overzicht te zien.
        </div>
      ) : reportSummary.error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {reportSummary.error}
        </div>
      ) : reportSummary.totalDays === undefined ||
        reportSummary.totalCost === undefined ||
        reportSummary.averageM2 === undefined ||
        reportSummary.rows === undefined ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-500">
          Geen rapportdata beschikbaar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Periode" value={`${reportSummary.totalDays} dagen`} />
            <StatCard
              label="Gem. bezet m²"
              value={reportSummary.averageM2.toFixed(2)}
            />
            <StatCard
              label="Bezettingsgraad"
              value={
                reportSummary.occupancyPercent == null
                  ? '–'
                  : `${reportSummary.occupancyPercent.toFixed(1)}%`
              }
            />
            <StatCard
              label="Te betalen"
              value={eur(reportSummary.totalCost)}
              emphasis="emerald"
              action={
                <button
                  type="button"
                  onClick={handleExportReportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel
                </button>
              }
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">OR</th>
                    <th className="px-4 py-2.5 text-left">Klant</th>
                    <th className="px-4 py-2.5 text-left">Referenties</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-left">Locatie</th>
                    <th className="px-4 py-2.5 text-right">m²</th>
                    <th className="px-4 py-2.5 text-right">Prijs/m²</th>
                    <th className="px-4 py-2.5 text-right">Dagen</th>
                    <th className="px-4 py-2.5 text-left">Periode</th>
                    <th className="px-4 py-2.5 text-right">Bedrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportSummary.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-sm text-gray-500 text-center">
                        Geen records in deze periode.
                      </td>
                    </tr>
                  ) : (
                    reportSummary.rows.map((row: ReportRow) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {row.or_number || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.customer}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-900 truncate max-w-xs">
                            {row.description || '—'}
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                            {row.customer_description && <span>{row.customer_description}</span>}
                            {row.foresco_id && <span>Foresco: {row.foresco_id}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              row.packing_status === 'verpakt'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.packing_status === 'verpakt' ? 'Verpakt' : 'Bare'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.location}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          {row.m2.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          {row.price ? `€ ${row.price.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          {row.overlapDays}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {row.start} → {row.end}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-emerald-700">
                          {eur(row.cost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  emphasis,
  action,
}: {
  label: string
  value: string
  emphasis?: 'emerald'
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-gray-500">{label}</div>
        {action}
      </div>
      <div
        className={`text-xl font-semibold mt-1 tabular-nums ${
          emphasis === 'emerald' ? 'text-emerald-700' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
