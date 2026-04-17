'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarRange, GitCompareArrows } from 'lucide-react'
import {
  COMPARE_PRESET_LABELS,
  type ComparePresetKey,
} from '@/lib/utils/periodPresets'

// Minimale set velden die alle flows leveren.
export interface CompareTotals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalMaterialCost: number
  totalIncoming: number
  avgLeadTimeHours: number | null
}

interface PeriodCompareCardProps {
  title?: string
  subtitle?: string
  accent?: 'indigo' | 'purple' | 'emerald'
  dateFrom: string
  dateTo: string
  compareEnabled: boolean
  compareFrom: string
  compareTo: string
  totals: CompareTotals | null
  compareTotals: CompareTotals | null
  loading?: boolean
  onApplyPreset: (key: ComparePresetKey) => void
  onEnableCompare?: () => void
  onDisableCompare?: () => void
  onChangeCompareRange?: (from: string, to: string) => void
  formatCurrency: (value: number) => string
}

function StatLine({
  label,
  value,
  deltaPct,
}: {
  label: string
  value: string
  deltaPct?: number | null
}) {
  const showDelta = deltaPct != null && Number.isFinite(deltaPct)
  const positive = showDelta && (deltaPct as number) > 0
  const negative = showDelta && (deltaPct as number) < 0
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-gray-100/80 last:border-0 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 tabular-nums text-right">{value}</span>
        {showDelta && (
          <span
            className={`text-[11px] font-semibold tabular-nums rounded-full px-1.5 py-0.5 ${
              positive
                ? 'bg-emerald-50 text-emerald-700'
                : negative
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {positive ? '▲' : negative ? '▼' : '='} {Math.abs(deltaPct as number).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  )
}

function pct(current: number, previous: number): number | null {
  if (!previous || !Number.isFinite(previous)) return null
  return ((current - previous) / previous) * 100
}

const ACCENTS: Record<
  NonNullable<PeriodCompareCardProps['accent']>,
  { icon: string; ring: string; border: string; bg: string; text: string; barA: string; barB: string }
> = {
  indigo: {
    icon: 'bg-indigo-600',
    ring: 'ring-indigo-100',
    border: 'border-indigo-200',
    bg: 'from-indigo-50/90',
    text: 'text-indigo-700',
    barA: '#4f46e5',
    barB: '#7c3aed',
  },
  purple: {
    icon: 'bg-purple-600',
    ring: 'ring-purple-100',
    border: 'border-purple-200',
    bg: 'from-purple-50/90',
    text: 'text-purple-700',
    barA: '#7c3aed',
    barB: '#c026d3',
  },
  emerald: {
    icon: 'bg-emerald-600',
    ring: 'ring-emerald-100',
    border: 'border-emerald-200',
    bg: 'from-emerald-50/90',
    text: 'text-emerald-700',
    barA: '#059669',
    barB: '#0ea5e9',
  },
}

export default function PeriodCompareCard({
  title = 'Periode-analyse & vergelijking',
  subtitle = 'Zet twee periodes naast elkaar met één klik of kies een eigen vergelijkingsperiode.',
  accent = 'indigo',
  dateFrom,
  dateTo,
  compareEnabled,
  compareFrom,
  compareTo,
  totals,
  compareTotals,
  loading = false,
  onApplyPreset,
  onEnableCompare,
  onDisableCompare,
  onChangeCompareRange,
  formatCurrency,
}: PeriodCompareCardProps) {
  const c = ACCENTS[accent]
  const periodADates = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : '—'
  const periodBDates =
    compareEnabled && compareFrom && compareTo ? `${compareFrom} → ${compareTo}` : '—'

  const hasCompareData = compareEnabled && compareTotals

  const chartData = hasCompareData
    ? [
        { metric: 'Items', A: totals?.totalItemsPacked ?? 0, B: compareTotals.totalItemsPacked },
        {
          metric: 'Manuren',
          A: Math.round((totals?.totalManHours ?? 0) * 10) / 10,
          B: Math.round(compareTotals.totalManHours * 10) / 10,
        },
        {
          metric: 'Omzet (k€)',
          A: Math.round(((totals?.totalRevenue ?? 0) / 1000) * 10) / 10,
          B: Math.round((compareTotals.totalRevenue / 1000) * 10) / 10,
        },
      ]
    : []

  const marginA = totals ? totals.totalRevenue - totals.totalMaterialCost : 0
  const marginB = compareTotals ? compareTotals.totalRevenue - compareTotals.totalMaterialCost : 0

  return (
    <div className={`mb-6 rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} via-white to-slate-50/80 p-5 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl ${c.icon} p-2.5 text-white shadow-md`}>
            <GitCompareArrows className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-0.5 max-w-2xl">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {COMPARE_PRESET_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onApplyPreset(key)}
              className={`text-xs font-semibold ${c.text} bg-white border ${c.border} rounded-full px-3 py-1.5 hover:bg-white/70 shadow-sm`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(onEnableCompare || onDisableCompare || onChangeCompareRange) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 font-medium text-gray-700">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) =>
                e.target.checked ? onEnableCompare?.() : onDisableCompare?.()
              }
              className="w-4 h-4 rounded border-gray-300"
            />
            Vergelijking inschakelen
          </label>
          {compareEnabled && onChangeCompareRange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Periode B:</span>
              <input
                type="date"
                value={compareFrom}
                onChange={(e) => onChangeCompareRange(e.target.value, compareTo)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={compareTo}
                onChange={(e) => onChangeCompareRange(compareFrom, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          )}
        </div>
      )}

      {!totals ? (
        <p className="text-sm text-gray-500">{loading ? 'Data laden…' : 'Laad eerst data via Vernieuwen.'}</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`rounded-xl border bg-white/90 p-4 shadow-sm ${hasCompareData ? `${c.border} ring-1 ${c.ring}` : 'border-gray-200'}`}>
            <div className={`flex items-center gap-2 mb-3 ${c.text}`}>
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wide">Periode A (analyse)</span>
            </div>
            <p className="text-xs text-gray-500 mb-3 font-mono">{periodADates}</p>
            <StatLine label="Dagen met activiteit" value={String(totals.totalDays)} />
            <StatLine
              label="Items verpakt"
              value={totals.totalItemsPacked.toLocaleString('nl-NL')}
              deltaPct={hasCompareData ? pct(totals.totalItemsPacked, compareTotals.totalItemsPacked) : undefined}
            />
            <StatLine
              label="Manuren"
              value={`${totals.totalManHours.toFixed(2)} u`}
              deltaPct={hasCompareData ? pct(totals.totalManHours, compareTotals.totalManHours) : undefined}
            />
            <StatLine
              label="Omzet"
              value={formatCurrency(totals.totalRevenue)}
              deltaPct={hasCompareData ? pct(totals.totalRevenue, compareTotals.totalRevenue) : undefined}
            />
            <StatLine
              label="Materiaalkost"
              value={formatCurrency(totals.totalMaterialCost)}
              deltaPct={hasCompareData ? pct(totals.totalMaterialCost, compareTotals.totalMaterialCost) : undefined}
            />
            <StatLine
              label="Bruto marge"
              value={formatCurrency(marginA)}
              deltaPct={hasCompareData ? pct(marginA, marginB) : undefined}
            />
            <StatLine
              label="Items / FTE (gem.)"
              value={totals.averageItemsPerFte.toFixed(2)}
              deltaPct={hasCompareData ? pct(totals.averageItemsPerFte, compareTotals.averageItemsPerFte) : undefined}
            />
            <StatLine
              label="Gem. items / dag"
              value={
                totals.totalDays > 0
                  ? (totals.totalItemsPacked / totals.totalDays).toFixed(0)
                  : '—'
              }
              deltaPct={
                hasCompareData && compareTotals.totalDays > 0
                  ? pct(
                      totals.totalItemsPacked / (totals.totalDays || 1),
                      compareTotals.totalItemsPacked / (compareTotals.totalDays || 1)
                    )
                  : undefined
              }
            />
          </div>

          {hasCompareData ? (
            <>
              <div className={`rounded-xl border ${c.border} bg-white/90 p-4 shadow-sm ring-1 ${c.ring}`}>
                <div className={`flex items-center gap-2 mb-3 ${c.text}`}>
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide">Periode B (vergelijking)</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 font-mono">{periodBDates}</p>
                <StatLine label="Dagen met activiteit" value={String(compareTotals.totalDays)} />
                <StatLine label="Items verpakt" value={compareTotals.totalItemsPacked.toLocaleString('nl-NL')} />
                <StatLine label="Manuren" value={`${compareTotals.totalManHours.toFixed(2)} u`} />
                <StatLine label="Omzet" value={formatCurrency(compareTotals.totalRevenue)} />
                <StatLine label="Materiaalkost" value={formatCurrency(compareTotals.totalMaterialCost)} />
                <StatLine label="Bruto marge" value={formatCurrency(marginB)} />
                <StatLine label="Items / FTE (gem.)" value={compareTotals.averageItemsPerFte.toFixed(2)} />
                <StatLine
                  label="Gem. items / dag"
                  value={
                    compareTotals.totalDays > 0
                      ? (compareTotals.totalItemsPacked / compareTotals.totalDays).toFixed(0)
                      : '—'
                  }
                />
              </div>

              <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Visuele vergelijking</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          v.toLocaleString('nl-NL'),
                          name === 'A' ? 'Periode A' : 'Periode B',
                        ]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Legend formatter={(value) => (value === 'A' ? 'Periode A' : 'Periode B')} />
                      <Bar dataKey="A" name="A" fill={c.barA} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="B" name="B" fill={c.barB} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Omzet in duizend euro (k€); items en manuren als absolute getallen.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white/50 p-6 flex flex-col items-center justify-center text-center text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Nog geen tweede periode</p>
              <p className="text-xs max-w-xs">
                Klik op een preset hierboven of schakel vergelijking in en kies handmatig een periode.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
