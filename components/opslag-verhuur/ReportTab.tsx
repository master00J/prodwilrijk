'use client'

import { Download } from 'lucide-react'
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
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-semibold mb-4">Klant rapport</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Klant</label>
          <select
            multiple
            value={reportCustomerIds}
            onChange={(e) =>
              setReportCustomerIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[140px]"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Geen selectie = alle klanten.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zoek OR / Omschrijving / Foresco ID
          </label>
          <input
            type="text"
            value={reportOrSearch}
            onChange={(e) => setReportOrSearch(e.target.value)}
            placeholder="Filter binnen geselecteerde klanten"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
          <input
            type="date"
            value={reportStartDate}
            onChange={(e) => setReportStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Einde</label>
          <input
            type="date"
            value={reportEndDate}
            onChange={(e) => setReportEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setReportCustomerIds([])
              setReportOrSearch('')
              setReportStartDate('')
              setReportEndDate('')
            }}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Reset
          </button>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setReportCustomerIds(customers.map((c) => String(c.id)))}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Selecteer alle
          </button>
        </div>
      </div>

      {!reportSummary ? (
        <p className="text-sm text-gray-500">
          Selecteer minstens één klant om een overzicht te zien. Vul optioneel een periode in om te
          filteren.
        </p>
      ) : reportSummary.error ? (
        <p className="text-sm text-red-600">{reportSummary.error}</p>
      ) : reportSummary.totalDays === undefined ||
        reportSummary.totalCost === undefined ||
        reportSummary.averageM2 === undefined ||
        reportSummary.rows === undefined ? (
        <p className="text-sm text-gray-500">Geen rapportdata beschikbaar.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Periode (dagen)</div>
              <div className="text-xl font-semibold">{reportSummary.totalDays}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Gem. bezet m²</div>
              <div className="text-xl font-semibold">{reportSummary.averageM2.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Bezettingsgraad</div>
              <div className="text-xl font-semibold">
                {reportSummary.occupancyPercent == null
                  ? '-'
                  : `${reportSummary.occupancyPercent.toFixed(1)}%`}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Te betalen</div>
              <div className="text-xl font-semibold">
                {reportSummary.totalCost.toLocaleString('nl-BE', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </div>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleExportReportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Exporteer Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">OR</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Klant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Omschr. klant
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Foresco ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Omschrijving
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Locatie
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    m²
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Prijs/m²
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Dagen
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Periode
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Bedrag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reportSummary.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-4 text-sm text-gray-500 text-center">
                      Geen records in deze periode.
                    </td>
                  </tr>
                ) : (
                  reportSummary.rows.map((row: ReportRow) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-sm font-medium">{row.or_number || '-'}</td>
                      <td className="px-3 py-2 text-sm">{row.customer}</td>
                      <td className="px-3 py-2 text-sm">{row.customer_description || '-'}</td>
                      <td className="px-3 py-2 text-sm">{row.foresco_id || '-'}</td>
                      <td className="px-3 py-2 text-sm">{row.description || '-'}</td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            row.packing_status === 'verpakt'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.packing_status || 'bare'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">{row.location}</td>
                      <td className="px-3 py-2 text-sm">{row.m2.toFixed(2)}</td>
                      <td className="px-3 py-2 text-sm">
                        {row.price ? row.price.toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.overlapDays}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {row.start} → {row.end}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {row.cost.toLocaleString('nl-BE', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
