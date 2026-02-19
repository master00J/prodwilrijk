'use client'

import { useRef } from 'react'
import Link from 'next/link'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart2,
  Euro,
  ArrowUpRight,
  Layers,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react'
import CollapsibleCard from '@/components/admin/prepack/CollapsibleCard'
import { usePrepackStats } from './usePrepackStats'
import type { CompareMode } from './types'

function ChartSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3 py-6">
      <div className="h-3 bg-gray-200 rounded w-1/4" />
      <div className="h-56 bg-gray-100 rounded-lg" />
      <div className="flex gap-4 justify-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="h-3 w-3 bg-gray-200 rounded-full" />
            <div className="h-2 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  accent: string
  sub?: string
}

function KpiCard({ label, value, icon, accent, sub }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${accent} shadow-sm p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
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
    queueStats,
    queueLoading,
    fetchQueueStats,
  } = api

  const grossMargin = totals ? totals.totalRevenue - totals.totalMaterialCost : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-3">
          ← Admin
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Prepack Analytics</h1>
            <p className="mt-1 text-gray-500 text-sm">Productiviteit, omzet en materiaalkosten voor de verpakkingsafdeling</p>
          </div>
          {lastUpdated && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              <RefreshCw className="w-3 h-3" />
              {formatDateTime(lastUpdated)}
            </span>
          )}
        </div>
        {dateFrom && dateTo && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1">
            <CalendarDays className="w-4 h-4" />
            {dateFrom} → {dateTo}
          </div>
        )}
      </div>

      {/* Live Wachtrij Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Live wachtrij — nu</h2>
          <button
            type="button"
            onClick={() => void fetchQueueStats()}
            disabled={queueLoading}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-full px-3 py-1"
          >
            <RefreshCw className={`w-3 h-3 ${queueLoading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>

        {queueLoading && !queueStats ? (
          <div className="animate-pulse grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : queueStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Stuks in wachtrij */}
            <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">In wachtrij</span>
                <ListOrdered className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-700">{queueStats.queueStuks.toLocaleString('nl-NL')}</div>
              <div className="text-xs text-gray-400 mt-0.5">{queueStats.queueLines} lijnen</div>
            </div>

            {/* Backlog */}
            <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${queueStats.backlogStuks > 0 ? 'border-red-500' : 'border-emerald-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Backlog</span>
                {queueStats.backlogStuks > 0
                  ? <AlertTriangle className="w-4 h-4 text-red-400" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                }
              </div>
              <div className={`text-3xl font-bold ${queueStats.backlogStuks > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {queueStats.backlogStuks.toLocaleString('nl-NL')}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {queueStats.backlogLines} lijnen · {queueStats.backlogPct}% van wachtrij
              </div>
            </div>

            {/* Prioriteit */}
            <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${queueStats.priorityStuks > 0 ? 'border-amber-400' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prioriteit</span>
                <AlertTriangle className={`w-4 h-4 ${queueStats.priorityStuks > 0 ? 'text-amber-400' : 'text-gray-300'}`} />
              </div>
              <div className={`text-3xl font-bold ${queueStats.priorityStuks > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {queueStats.priorityStuks.toLocaleString('nl-NL')}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">prioritaire stuks</div>
            </div>

            {/* Oudste item */}
            <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${queueStats.oldestWorkingDays > 5 ? 'border-orange-400' : 'border-slate-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Oudste item</span>
                <Clock className={`w-4 h-4 ${queueStats.oldestWorkingDays > 5 ? 'text-orange-400' : 'text-slate-400'}`} />
              </div>
              <div className={`text-3xl font-bold ${queueStats.oldestWorkingDays > 5 ? 'text-orange-600' : 'text-slate-700'}`}>
                {queueStats.oldestWorkingDays}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">werkdagen in wachtrij</div>
            </div>

            {/* Gem. doorlooptijd */}
            <div className="bg-white rounded-xl border-l-4 border-teal-400 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gem. doorlooptijd</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-3xl font-bold text-teal-700">
                {queueStats.avgLeadTimeDays != null ? queueStats.avgLeadTimeDays : '—'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">werkdagen (60 dgn gem.)</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Date Filters & KPI's */}
      <div className="mb-6">
        <CollapsibleCard
          id="filters"
          title="Filters & Instellingen"
          isCollapsed={collapsedSections.filters}
          onToggle={() => toggleSection('filters')}
        >
          {/* Datumfilter */}
          <div className="mb-5 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700">Vanaf</label>
              <input
                type="date"
                ref={dateFromInputRef}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700">Tot</label>
              <input
                type="date"
                ref={dateToInputRef}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {/* Preset button group */}
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(
                [
                  ['thisMonth', 'Deze maand'],
                  ['prevMonth', 'Vorige maand'],
                  ['thisQuarter', 'Dit kwartaal'],
                  ['prevQuarter', 'Vorig kwartaal'],
                  ['thisYear', 'Dit jaar'],
                  ['prevYear', 'Vorig jaar'],
                ] as const
              ).map(([preset, label], i) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-3 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 ${
                    i > 0 ? 'border-l border-gray-200' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void handleRefresh()}
              disabled={loading || !dateFrom || !dateTo}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Laden...' : 'Vernieuwen'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting || dailyStats.length === 0}
              className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {exporting ? 'Exporteren...' : '↓ Excel'}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 px-4 py-3 bg-gray-50">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={missingCostOnly}
                onChange={(e) => setMissingCostOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Toon enkel items zonder prijs of materiaalkost
            </label>
          </div>

          <div className="mb-6 rounded-xl border border-gray-200 p-4 bg-white">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareEnabled}
                  onChange={(e) => setCompareEnabled(e.target.checked)}
                  className="rounded border-gray-300"
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
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-gray-500">Vergelijking:</span>
                  <span className="font-semibold text-gray-900">{compareModeLabel}</span>
                  <span className="text-gray-400 bg-gray-100 rounded px-2 py-0.5 text-xs">
                    {compareEffectiveFrom || '—'} → {compareEffectiveTo || '—'}
                  </span>
                  <span className="text-gray-400 text-xs">
                    Huidig: {compareMode === 'selectedDays' ? comparePrimaryTotals?.totalDays ?? 0 : totals?.totalDays ?? 0} dag(en) · Vergelijking: {compareTotals?.totalDays ?? 0} dag(en)
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Metric</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {compareMode === 'selectedDays' ? `Dag 1 (${compareEffectiveFrom || '—'})` : 'Huidige periode'}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {compareMode === 'selectedDays' ? `Dag 2 (${compareEffectiveTo || '—'})` : 'Vergelijking'}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">Verschil</th>
                        <th className="px-4 py-3 text-right font-semibold">% wijziging</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(
                        [
                          {
                            label: 'Items verpakt',
                            current: (compareMode === 'selectedDays' ? comparePrimaryTotals?.totalItemsPacked : totals?.totalItemsPacked)?.toLocaleString('nl-NL') ?? '-',
                            compare: compareTotals?.totalItemsPacked.toLocaleString('nl-NL') ?? '-',
                            diff: compareSummary ? formatSignedNumber(compareSummary.items.diff) : '-',
                            pct: compareSummary?.items.pct,
                            positiveIsGood: true,
                          },
                          {
                            label: 'Goederen binnen',
                            current: (compareMode === 'selectedDays' ? comparePrimaryTotals?.totalIncoming : totals?.totalIncoming)?.toLocaleString('nl-NL') ?? '-',
                            compare: compareTotals?.totalIncoming.toLocaleString('nl-NL') ?? '-',
                            diff: compareSummary ? formatSignedNumber(compareSummary.incoming.diff) : '-',
                            pct: compareSummary?.incoming.pct,
                            positiveIsGood: true,
                          },
                          {
                            label: 'Manuren',
                            current: compareMode === 'selectedDays' ? (comparePrimaryTotals ? comparePrimaryTotals.totalManHours.toFixed(2) : '-') : (totals ? totals.totalManHours.toFixed(2) : '-'),
                            compare: compareTotals ? compareTotals.totalManHours.toFixed(2) : '-',
                            diff: compareSummary ? formatSignedNumber(compareSummary.manHours.diff, 2) : '-',
                            pct: compareSummary?.manHours.pct,
                            positiveIsGood: false,
                          },
                          {
                            label: 'Omzet',
                            current: compareMode === 'selectedDays' ? (comparePrimaryTotals ? formatCurrency(comparePrimaryTotals.totalRevenue) : '-') : (totals ? formatCurrency(totals.totalRevenue) : '-'),
                            compare: compareTotals ? formatCurrency(compareTotals.totalRevenue) : '-',
                            diff: compareSummary ? formatSignedCurrency(compareSummary.revenue.diff) : '-',
                            pct: compareSummary?.revenue.pct,
                            positiveIsGood: true,
                          },
                        ] as const
                      ).map((row) => {
                        const pctNum = row.pct ?? null
                        const isPositive = pctNum != null && pctNum > 0
                        const isNegative = pctNum != null && pctNum < 0
                        const diffColor = row.positiveIsGood
                          ? isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-gray-600'
                          : isPositive ? 'text-red-500' : isNegative ? 'text-emerald-600' : 'text-gray-600'
                        return (
                          <tr key={row.label} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{row.label}</td>
                            <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums">{row.current}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{row.compare}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${diffColor}`}>{row.diff}</td>
                            <td className={`px-4 py-2.5 text-right tabular-nums ${diffColor}`}>
                              {pctNum == null ? '-' : (
                                <span className="inline-flex items-center gap-0.5">
                                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : isNegative ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                                  {pctNum.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {compareEnabled && compareTotals && (
              <div className="mt-2 text-xs text-gray-500">
                Dagrecords vergelijking: {compareDailyStats.length}
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-5">
            <KpiCard
              label="Goederen binnen"
              value={totals ? totals.totalIncoming.toLocaleString('nl-NL') : '—'}
              icon={<Layers className="w-5 h-5 text-slate-500" />}
              accent="border-slate-400"
            />
            <KpiCard
              label="Items verpakt"
              value={totals ? totals.totalItemsPacked.toLocaleString('nl-NL') : '—'}
              icon={<Package className="w-5 h-5 text-blue-500" />}
              accent="border-blue-500"
            />
            <KpiCard
              label="Totale manuren"
              value={totals ? `${totals.totalManHours.toFixed(2)} u` : '—'}
              icon={<Clock className="w-5 h-5 text-emerald-500" />}
              accent="border-emerald-500"
            />
            <KpiCard
              label="Items / FTE"
              value={totals ? totals.averageItemsPerFte.toFixed(2) : '—'}
              icon={<BarChart2 className="w-5 h-5 text-indigo-500" />}
              accent="border-indigo-500"
            />
            <KpiCard
              label="Totale omzet"
              value={totals ? formatCurrency(totals.totalRevenue) : '—'}
              icon={<Euro className="w-5 h-5 text-amber-500" />}
              accent="border-amber-500"
            />
            <KpiCard
              label="Totale materiaalkost"
              value={totals ? formatCurrency(totals.totalMaterialCost) : '—'}
              icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
              accent="border-rose-500"
            />
            <KpiCard
              label="Bruto marge"
              value={grossMargin != null ? formatCurrency(grossMargin) : '—'}
              sub={grossMargin != null && totals && totals.totalRevenue > 0 ? `${((grossMargin / totals.totalRevenue) * 100).toFixed(1)}% van omzet` : undefined}
              icon={<TrendingUp className="w-5 h-5 text-teal-500" />}
              accent="border-teal-500"
            />
            <KpiCard
              label="Binnen vs verpakt"
              value={totals && totals.incomingVsPackedRatio != null ? `${totals.incomingVsPackedRatio.toFixed(2)}×` : '—'}
              icon={<ArrowUpRight className="w-5 h-5 text-slate-400" />}
              accent="border-slate-300"
            />
          </div>

          {/* Secundaire KPI's */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Gem. manuren/dag', value: totals ? `${kpiStats.avgManHoursPerDay.toFixed(2)} u` : '—', sub: 'Gemiddeld per werkdag' },
              { label: 'Gem. FTE/dag', value: totals ? totals.avgFtePerDay.toFixed(2) : '—', sub: 'Ma–Do 8u, Vr 7u' },
              { label: 'Gem. materiaalkost/dag', value: totals ? formatCurrency(kpiStats.avgMaterialCostPerDay) : '—', sub: 'Op basis van BOM' },
              { label: 'Gem. doorlooptijd', value: totals ? formatLeadTime(totals.avgLeadTimeHours) : '—', sub: 'Ontvangen → verpakt' },
              { label: 'Beste productiviteit', value: kpiStats.bestProductivityDay ? `${kpiStats.bestProductivityDay.itemsPerFte.toFixed(2)} i/FTE` : '—', sub: kpiStats.bestProductivityDay ? formatDate(kpiStats.bestProductivityDay.date) : '—' },
              { label: 'Piekvolume', value: kpiStats.peakDay ? `${kpiStats.peakDay.itemsPacked} items` : '—', sub: kpiStats.peakDay ? formatDate(kpiStats.peakDay.date) : '—' },
              { label: 'Actieve medewerkers', value: totals ? String(kpiStats.activeEmployees) : '—', sub: 'Unieke medewerkers' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className="text-xs text-gray-500 mb-1 leading-tight">{kpi.label}</div>
                <div className="text-base font-semibold text-gray-900">{kpi.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>

      {/* Charts Section — 2×2 grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Output & Manuren */}
        <CollapsibleCard
          id="chartOutput"
          title="Output & Manuren"
          subtitle="Items verpakt, manuren en FTE per dag"
          isCollapsed={collapsedSections.chartOutput}
          onToggle={() => toggleSection('chartOutput')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={dailyStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradItems" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => formatDate(v as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'Manuren') return [`${value.toFixed(2)} uur`, name]
                    if (name === 'FTE') return [value.toFixed(2), name]
                    return [value, name]
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="itemsPacked" stroke="#2563eb" fill="url(#gradItems)" strokeWidth={2} name="Items" dot={false} />
                <Line type="monotone" dataKey="manHours" stroke="#10b981" strokeWidth={2} name="Manuren" dot={false} />
                <Line type="monotone" dataKey="fte" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" name="FTE" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>

        {/* Omzet + Materiaalkost gecombineerd */}
        <CollapsibleCard
          id="chartRevenue"
          title="Omzet & Materiaalkost"
          subtitle="Dagelijkse omzet en materiaalkost"
          isCollapsed={collapsedSections.chartRevenue}
          onToggle={() => toggleSection('chartRevenue')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={dailyStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMaterial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.10} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => formatDate(v as string)}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#gradRevenue)" strokeWidth={2.5} name="Omzet" dot={false} />
                <Area type="monotone" dataKey="materialCost" stroke="#f43f5e" fill="url(#gradMaterial)" strokeWidth={2} name="Materiaalkost" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>

        {/* Productiviteit */}
        <CollapsibleCard
          id="productivity"
          title="Productiviteit"
          subtitle="Items per FTE per dag"
          isCollapsed={collapsedSections.productivity}
          onToggle={() => toggleSection('productivity')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={dailyStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => formatDate(v as string)}
                  formatter={(value: number) => [`${value.toFixed(2)} items/FTE`, 'Productiviteit']}
                />
                <Area type="monotone" dataKey="itemsPerFte" stroke="#8b5cf6" fill="url(#gradProd)" strokeWidth={2.5} name="Items/FTE" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>

        {/* Binnengekomen vs verpakt */}
        <CollapsibleCard
          id="chartIncoming"
          title="Binnengekomen vs Verpakt"
          subtitle="Vergelijking goederen in- en uitstroom"
          isCollapsed={collapsedSections.chartIncoming}
          onToggle={() => toggleSection('chartIncoming')}
        >
          {loading ? (
            <ChartSkeleton />
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={dailyStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => formatDate(v as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'FTE') return [value.toFixed(2), name]
                    return [value, name]
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="incomingItems" stroke="#0ea5e9" strokeWidth={2} name="Goederen binnen" dot={false} />
                <Line type="monotone" dataKey="itemsPacked" stroke="#2563eb" strokeWidth={2} name="Items verpakt" dot={false} />
                <Line type="monotone" dataKey="fte" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" name="FTE" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      {/* Werkende Personen */}
      <div className="mb-6">
        <CollapsibleCard
          id="people"
          title="Medewerkers"
          subtitle="Manuren per persoon in de geselecteerde periode"
          isCollapsed={collapsedSections.people}
          onToggle={() => toggleSection('people')}
        >
        {loading ? (
          <div className="animate-pulse space-y-3 py-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 bg-gray-200 rounded w-28" />
                <div className="h-4 bg-gray-100 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-12" />
              </div>
            ))}
          </div>
        ) : personStats.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (() => {
          const maxHours = Math.max(...personStats.map(s => s.manHours))
          return (
            <div className="space-y-2.5">
              {personStats
                .slice()
                .sort((a, b) => b.manHours - a.manHours)
                .map((stat) => {
                  const pct = maxHours > 0 ? (stat.manHours / maxHours) * 100 : 0
                  return (
                    <div key={stat.name} className="flex items-center gap-3 group">
                      <div className="w-36 shrink-0 text-sm font-medium text-gray-800 truncate">{stat.name}</div>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-sm tabular-nums text-gray-700 font-medium">
                        {stat.manHours.toFixed(2)} u
                      </div>
                    </div>
                  )
                })}
            </div>
          )
        })()}
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
        subtitle="Overzicht per dag"
        isCollapsed={collapsedSections.daily}
        onToggle={() => toggleSection('daily')}
      >
        {loading ? (
          <div className="animate-pulse space-y-2 py-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (() => {
          const maxRevenue = Math.max(...dailyStats.map(s => s.revenue))
          const avgRevenue = dailyStats.reduce((a, s) => a + s.revenue, 0) / dailyStats.length
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left font-semibold">Datum</th>
                    <th className="px-4 py-3 text-right font-semibold">Goedren binnen</th>
                    <th className="px-4 py-3 text-right font-semibold">Verpakt</th>
                    <th className="px-4 py-3 text-right font-semibold">Manuren</th>
                    <th className="px-4 py-3 text-right font-semibold">FTE</th>
                    <th className="px-4 py-3 text-right font-semibold">MDW</th>
                    <th className="px-4 py-3 text-right font-semibold">Items/FTE</th>
                    <th className="px-4 py-3 text-right font-semibold">Omzet</th>
                    <th className="px-4 py-3 text-right font-semibold">Materiaal</th>
                    <th className="px-4 py-3 text-right font-semibold">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyStats.map((stat) => {
                    const isTop = stat.revenue === maxRevenue && maxRevenue > 0
                    const isAboveAvg = stat.revenue > avgRevenue
                    const margin = stat.revenue - stat.materialCost
                    const marginPct = stat.revenue > 0 ? (margin / stat.revenue) * 100 : null
                    return (
                      <tr
                        key={stat.date}
                        className={`hover:bg-blue-50 transition-colors ${isTop ? 'bg-amber-50' : isAboveAvg ? 'bg-white' : 'bg-white'}`}
                      >
                        <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">
                          {isTop && <span className="mr-1 text-amber-500 text-xs">★</span>}
                          {new Date(stat.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{stat.incomingItems.toLocaleString('nl-NL')}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-700 tabular-nums">{stat.itemsPacked}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{stat.manHours.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{stat.fte.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{stat.employeeCount}</td>
                        <td className="px-4 py-2.5 text-right text-indigo-600 tabular-nums font-medium">{stat.itemsPerFte.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                          €{stat.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-rose-600 tabular-nums">
                          €{stat.materialCost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${marginPct != null && marginPct < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                          {marginPct != null ? `${marginPct.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </CollapsibleCard>
    </div>
  )
}
