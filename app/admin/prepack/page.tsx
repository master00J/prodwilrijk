'use client'

import { useRef } from 'react'
import Link from 'next/link'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import CollapsibleCard from '@/components/admin/prepack/CollapsibleCard'
import { usePrepackStats } from './usePrepackStats'
import type { CompareMode } from './types'

function ChartSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3 py-8">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-100 rounded" />
      <div className="flex gap-2">
        <div className="h-3 bg-gray-200 rounded flex-1" />
        <div className="h-3 bg-gray-200 rounded flex-1" />
        <div className="h-3 bg-gray-200 rounded flex-1" />
      </div>
    </div>
  )
}

export default function PrepackMonitorPage() {
  const dateFromInputRef = useRef<HTMLInputElement>(null)
  const dateToInputRef = useRef<HTMLInputElement>(null)
  const compareFromInputRef = useRef<HTMLInputElement>(null)
  const compareToInputRef = useRef<HTMLInputElement>(null)

  const api = usePrepackStats(
    dateFromInputRef,
    dateToInputRef,
    compareFromInputRef,
    compareToInputRef
  )

  const {
    dateFrom,
    dateTo,
    loading,
    exporting,
    lastUpdated,
    dailyStats,
    totals,
    personStats,
    detailsLimited,
    missingCostOnly,
    setMissingCostOnly,
    bomLoading,
    bomError,
    bomDetail,
    compareEnabled,
    setCompareEnabled,
    compareMode,
    setCompareMode,
    compareFrom,
    setCompareFrom,
    compareTo,
    setCompareTo,
    compareEffectiveFrom,
    compareEffectiveTo,
    comparePrimaryTotals,
    compareTotals,
    compareDailyStats,
    collapsedSections,
    toggleSection,
    kpiStats,
    filteredDetailedItems,
    compareSummary,
    compareModeLabel,
    formatDate,
    formatCurrency,
    formatDateTime,
    formatLeadTime,
    formatSignedNumber,
    formatSignedCurrency,
    handleRefresh,
    handleApplyPreset,
    handleExportExcel,
    openBomDetail,
    closeBomDetail,
  } = api

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Terug naar Admin
        </Link>
        <h1 className="text-3xl font-bold">Prepack Flow Monitoring</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
            Periode: {dateFrom || '—'} → {dateTo || '—'}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
            Laatste update: {lastUpdated ? formatDateTime(lastUpdated) : '—'}
          </span>
        </div>
      </div>

      {/* Date Filters & KPI's */}
      <div className="mb-6">
        <CollapsibleCard
          id="filters"
          title="Filters & KPI's"
          isCollapsed={collapsedSections.filters}
          onToggle={() => toggleSection('filters')}
        >
          <div className="mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block mb-2 font-medium">Vanaf Datum</label>
              <input
                type="date"
                ref={dateFromInputRef}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Tot Datum</label>
              <input
                type="date"
                ref={dateToInputRef}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('thisMonth')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Deze maand
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevMonth')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorige maand
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('thisQuarter')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Dit kwartaal
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevQuarter')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorig kwartaal
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('thisYear')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Dit jaar
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevYear')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorig jaar
              </button>
            </div>
            <button
              onClick={() => void handleRefresh()}
              disabled={loading || !dateFrom || !dateTo}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Laden...' : 'Vernieuwen'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting || dailyStats.length === 0}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {exporting ? 'Exporteren...' : 'Export naar Excel'}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={missingCostOnly}
                onChange={(e) => setMissingCostOnly(e.target.checked)}
              />
              Toon enkel items zonder prijs of materiaalkost
            </label>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={compareEnabled}
                  onChange={(e) => setCompareEnabled(e.target.checked)}
                />
                Vergelijking inschakelen
              </label>
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as CompareMode)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!compareEnabled}
              >
                <option value="selectedDays">Twee dagen vergelijken</option>
                <option value="previous">Vorige periode (zelfde lengte)</option>
                <option value="lastYear">Zelfde periode vorig jaar</option>
                <option value="custom">Aangepaste periode</option>
              </select>
              {compareEnabled && (
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm text-gray-600">Dag 1 (eerste datum)</label>
                    <input
                      type="date"
                      ref={compareFromInputRef}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onChange={(e) => setCompareFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Dag 2 (tweede datum)</label>
                    <input
                      type="date"
                      ref={compareToInputRef}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onChange={(e) => setCompareTo(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Vergelijk toepassen
                  </button>
                </div>
              )}
              {compareEnabled && compareMode === 'selectedDays' && (
                <p className="mt-2 text-xs text-gray-500">
                  Vul beide datums in (dag 1 en dag 2) en klik op Vernieuwen of Vergelijk toepassen om het verschil te zien.
                </p>
              )}
            </div>

            {compareEnabled && compareTotals && (
              <div className="mt-4 space-y-4">
                <div className="text-sm text-gray-600">
                  Vergelijking: <span className="font-medium text-gray-900">{compareModeLabel}</span>
                  <span className="ml-2 text-gray-500">
                    ({compareEffectiveFrom || '—'} → {compareEffectiveTo || '—'})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Metric</th>
                        <th className="px-4 py-2 text-left font-medium">
                          {compareMode === 'selectedDays'
                            ? `Dag 1 (${compareEffectiveFrom || '—'})`
                            : 'Huidige periode'}
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          {compareMode === 'selectedDays'
                            ? `Dag 2 (${compareEffectiveTo || '—'})`
                            : 'Vergelijking'}
                        </th>
                        <th className="px-4 py-2 text-left font-medium">Verschil</th>
                        <th className="px-4 py-2 text-left font-medium">% wijziging</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Items verpakt</td>
                        <td className="px-4 py-2 text-gray-900">
                          {(compareMode === 'selectedDays' ? comparePrimaryTotals?.totalItemsPacked : totals?.totalItemsPacked)?.toLocaleString('nl-NL') ??
                            '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals?.totalItemsPacked.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.items.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.items.pct == null ? '-' : `${compareSummary.items.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Goederen binnen</td>
                        <td className="px-4 py-2 text-gray-900">
                          {(compareMode === 'selectedDays' ? comparePrimaryTotals?.totalIncoming : totals?.totalIncoming)?.toLocaleString('nl-NL') ??
                            '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals?.totalIncoming.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.incoming.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.incoming.pct == null ? '-' : `${compareSummary.incoming.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Manuren</td>
                        <td className="px-4 py-2 text-gray-900">
                          {compareMode === 'selectedDays'
                            ? comparePrimaryTotals
                              ? comparePrimaryTotals.totalManHours.toFixed(2)
                              : '-'
                            : totals
                              ? totals.totalManHours.toFixed(2)
                              : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals ? compareTotals.totalManHours.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.manHours.diff, 2) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.manHours.pct == null ? '-' : `${compareSummary.manHours.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Omzet</td>
                        <td className="px-4 py-2 text-gray-900">
                          {compareMode === 'selectedDays'
                            ? comparePrimaryTotals
                              ? formatCurrency(comparePrimaryTotals.totalRevenue)
                              : '-'
                            : totals
                              ? formatCurrency(totals.totalRevenue)
                              : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals ? formatCurrency(compareTotals.totalRevenue) : '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedCurrency(compareSummary.revenue.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.revenue.pct == null ? '-' : `${compareSummary.revenue.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500">
                  Periode-dagen: huidig{' '}
                  {compareMode === 'selectedDays' ? comparePrimaryTotals?.totalDays ?? 0 : totals?.totalDays ?? 0} ·
                  vergelijking {compareTotals?.totalDays ?? 0}
                </div>
              </div>
            )}

            {compareEnabled && compareTotals && (
              <div className="mt-2 text-xs text-gray-500">
                Dagrecords vergelijking: {compareDailyStats.length}
              </div>
            )}
          </div>

          {/* KPI Cards - responsive: 2 cols mobile, 4 tablet, 6 desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Goederen binnen</div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-800">
                {totals ? totals.totalIncoming.toLocaleString('nl-NL') : '-'}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-sm text-gray-600 mb-1">Items verpakt</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-700">
                {totals ? totals.totalItemsPacked.toLocaleString('nl-NL') : '-'}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <div className="text-sm text-gray-600 mb-1">Totale manuren</div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-700">
                {totals ? totals.totalManHours.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <div className="text-sm text-gray-600 mb-1">Items/FTE</div>
              <div className="text-2xl sm:text-3xl font-bold text-indigo-700">
                {totals ? totals.averageItemsPerFte.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <div className="text-sm text-gray-600 mb-1">Totale omzet</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-700">
                {totals ? formatCurrency(totals.totalRevenue) : '-'}
              </div>
            </div>
            <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
              <div className="text-sm text-gray-600 mb-1">Totale materiaalkost</div>
              <div className="text-2xl sm:text-3xl font-bold text-rose-700">
                {totals ? formatCurrency(totals.totalMaterialCost) : '-'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Gem. items per dag</div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-800">
                {totals ? kpiStats.avgItemsPerDay.toFixed(0) : '-'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Binnen vs verpakt</div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-800">
                {totals && totals.incomingVsPackedRatio != null
                  ? `${totals.incomingVsPackedRatio.toFixed(2)}x`
                  : '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gemiddelde per dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? `${kpiStats.avgManHoursPerDay.toFixed(2)} uur` : '-'}
              </div>
              <div className="text-xs text-gray-500">Manuren per dag</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. FTE per dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? totals.avgFtePerDay.toFixed(2) : '-'}
              </div>
              <div className="text-xs text-gray-500">Ma–Do 8u, Vr 7u</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. materiaalkost/dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? formatCurrency(kpiStats.avgMaterialCostPerDay) : '-'}
              </div>
              <div className="text-xs text-gray-500">Op basis van BOM</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. doorlooptijd (werkdagen)</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? formatLeadTime(totals.avgLeadTimeHours) : '-'}
              </div>
              <div className="text-xs text-gray-500">Date added → date packed</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Beste productiviteit</div>
              <div className="text-lg font-semibold text-gray-900">
                {kpiStats.bestProductivityDay
                  ? `${kpiStats.bestProductivityDay.itemsPerFte.toFixed(2)} items/FTE`
                  : '-'}
              </div>
              <div className="text-xs text-gray-500">
                {kpiStats.bestProductivityDay ? formatDate(kpiStats.bestProductivityDay.date) : '-'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Piekvolume</div>
              <div className="text-lg font-semibold text-gray-900">
                {kpiStats.peakDay ? `${kpiStats.peakDay.itemsPacked} items` : '-'}
              </div>
              <div className="text-xs text-gray-500">
                {kpiStats.peakDay ? formatDate(kpiStats.peakDay.date) : '-'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Actieve medewerkers</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? kpiStats.activeEmployees : '-'}
              </div>
              <div className="text-xs text-gray-500">Unieke medewerkers</div>
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <CollapsibleCard
          id="chartOutput"
          title="Output & Manuren"
          subtitle="Items en manuren per dag"
          isCollapsed={collapsedSections.chartOutput}
          onToggle={() => toggleSection('chartOutput')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'Manuren') {
                      return [`${value.toFixed(2)} uur`, 'Manuren']
                    }
                    if (name === 'FTE') {
                      return [value.toFixed(2), 'FTE']
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="itemsPacked"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Items"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="manHours"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Manuren"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fte"
                  stroke="#0f172a"
                  strokeWidth={2}
                  name="FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          id="chartRevenue"
          title="Omzet trend"
          subtitle="Dagelijkse omzet"
          isCollapsed={collapsedSections.chartRevenue}
          onToggle={() => toggleSection('chartRevenue')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [formatCurrency(value), 'Omzet']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  name="Omzet"
                  dot={{ fill: '#f59e0b', r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard
          id="chartMaterial"
          title="Materiaalkost trend"
          subtitle="Dagelijkse materiaalkost"
          isCollapsed={collapsedSections.chartMaterial}
          onToggle={() => toggleSection('chartMaterial')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [formatCurrency(value), 'Materiaalkost']}
                />
                <Line
                  type="monotone"
                  dataKey="materialCost"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  name="Materiaalkost"
                  dot={{ fill: '#f43f5e', r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard
          id="productivity"
          title="Productiviteit"
          subtitle="Items per FTE"
          isCollapsed={collapsedSections.productivity}
          onToggle={() => toggleSection('productivity')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [`${value.toFixed(2)} items/FTE`, 'Productiviteit']}
                />
                <Line
                  type="monotone"
                  dataKey="itemsPerFte"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Items/FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard
          id="chartIncoming"
          title="Binnengekomen vs verpakt"
          subtitle="Goederen per dag"
          isCollapsed={collapsedSections.chartIncoming}
          onToggle={() => toggleSection('chartIncoming')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'FTE') {
                      return [value.toFixed(2), 'FTE']
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="incomingItems"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Goederen binnen"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="itemsPacked"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Items verpakt"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fte"
                  stroke="#0f172a"
                  strokeWidth={2}
                  name="FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      {/* Werkende Personen */}
      <div className="mb-6">
        <CollapsibleCard
          id="people"
          title="Werkende Personen"
          isCollapsed={collapsedSections.people}
          onToggle={() => toggleSection('people')}
        >
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : personStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Persoon</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {personStats.map((stat) => (
                  <tr key={stat.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CollapsibleCard>
      </div>

      {/* Detailed Items List */}
      <div className="mb-6">
        <CollapsibleCard
          id="details"
          title="Gedetailleerde Lijst Verpakte Items"
          isCollapsed={collapsedSections.details}
          onToggle={() => toggleSection('details')}
        >
        {detailsLimited && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            Detailtabel is ingeklapt voor deze grote periode. Beperk de periode om details te tonen.
          </div>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Items laden...</div>
          </div>
        ) : filteredDetailedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen items gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Itemnummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">PO Nummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aantal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Prijs</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost/stuk</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">BOM</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDetailedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.date_packed).toLocaleDateString('nl-NL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.po_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.amount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.price > 0 ? `€${item.price.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.revenue > 0 ? `€${item.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.materialCostUnit > 0
                        ? `€${item.materialCostUnit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.materialCostTotal > 0
                        ? `€${item.materialCostTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <button
                        type="button"
                        onClick={() => openBomDetail(item.item_number)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Bekijk
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CollapsibleCard>
      </div>

      {bomDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">BOM detail</div>
                <div className="text-sm text-gray-500">
                  Itemnummer: {bomDetail.item_number}
                </div>
              </div>
              <button
                type="button"
                onClick={closeBomDetail}
                className="text-gray-500 hover:text-gray-700"
              >
                Sluiten
              </button>
            </div>
            <div className="p-4 space-y-6">
              {bomError && <div className="text-sm text-red-600">{bomError}</div>}
              {bomLoading ? (
                <div className="text-sm text-gray-500">Laden...</div>
              ) : (
                bomDetail.lines?.map((line: any) => (
                  <div key={line.line_no || line.description} className="border rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {line.description || '-'} {line.order_number ? `(${line.order_number})` : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          Aantal: {line.quantity} · Kost/stuk: €{Number(line.cost_per_item || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-1 pr-3">Component</th>
                            <th className="py-1 pr-3">Eenheid</th>
                            <th className="py-1 pr-3">Prijs</th>
                            <th className="py-1 pr-3">Aantal</th>
                            <th className="py-1 pr-3">Afmetingen (mm)</th>
                            <th className="py-1 pr-3">Kost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.components?.map((component: any, idx: number) => (
                            <tr key={`${component.component_item_no}-${idx}`} className="border-t">
                              <td className="py-1 pr-3">
                                {component.component_item_no || '-'} {component.description || ''}
                              </td>
                              <td className="py-1 pr-3">{component.unit_of_measure || 'stuks'}</td>
                              <td className="py-1 pr-3">
                                {component.price !== undefined && component.price !== null
                                  ? `€${Number(component.price).toFixed(5)}`
                                  : '-'}
                              </td>
                              <td className="py-1 pr-3">{component.unit_count}</td>
                              <td className="py-1 pr-3">
                                {component.length}×{component.width}×{component.thickness}
                              </td>
                              <td className="py-1 pr-3">€{Number(component.cost || 0).toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Statistics Table */}
      <CollapsibleCard
        id="daily"
        title="Dagelijkse Statistieken"
        isCollapsed={collapsedSections.daily}
        onToggle={() => toggleSection('daily')}
      >
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Goederen binnen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">FTE</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medewerkers</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/FTE</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyStats.map((stat) => (
                  <tr key={stat.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(stat.date).toLocaleDateString('nl-NL', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {stat.incomingItems.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.itemsPacked}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.fte.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.employeeCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPerFte.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.materialCost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleCard>
    </div>
  )
}
