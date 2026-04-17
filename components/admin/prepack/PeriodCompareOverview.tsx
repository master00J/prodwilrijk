'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarRange, GitCompareArrows } from 'lucide-react'
import type { CompareMode, Totals } from '@/app/admin/prepack/types'

export type ComparePresetKey =
  | 'thisWeekVsLastWeek'
  | 'thisMonthVsLastMonth'
  | 'thisMonthVsLastYearSameMonth'
  | 'thisQuarterVsLastQuarter'
  | 'thisYearVsLastYear'

interface PeriodCompareOverviewProps {
  dateFrom: string
  dateTo: string
  compareEnabled: boolean
  compareMode: CompareMode
  compareEffectiveFrom: string
  compareEffectiveTo: string
  totals: Totals | null
  compareTotals: Totals | null
  comparePrimaryTotals: Totals | null
  onApplyComparePreset: (key: ComparePresetKey) => void
  formatCurrency: (value: number) => string
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-gray-100/80 last:border-0 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900 tabular-nums text-right">{value}</span>
    </div>
  )
}

export default function PeriodCompareOverview({
  dateFrom,
  dateTo,
  compareEnabled,
  compareMode,
  compareEffectiveFrom,
  compareEffectiveTo,
  totals,
  compareTotals,
  comparePrimaryTotals,
  onApplyComparePreset,
  formatCurrency,
}: PeriodCompareOverviewProps) {
  const displayPrimary =
    compareEnabled && compareMode === 'selectedDays' ? comparePrimaryTotals : totals
  const comp = compareTotals

  const presets: { key: ComparePresetKey; label: string }[] = [
    { key: 'thisWeekVsLastWeek', label: 'Deze week ↔ vorige' },
    { key: 'thisMonthVsLastMonth', label: 'Deze maand ↔ vorige' },
    { key: 'thisMonthVsLastYearSameMonth', label: 'Deze maand ↔ jaar geleden' },
    { key: 'thisQuarterVsLastQuarter', label: 'Kwartaal ↔ vorige' },
    { key: 'thisYearVsLastYear', label: 'Jaar ↔ vorig jaar' },
  ]

  const periodALabel = compareMode === 'selectedDays' ? 'Dag 1' : 'Periode A (analyse)'
  const periodBLabel = compareMode === 'selectedDays' ? 'Dag 2' : 'Periode B (vergelijking)'
  const periodADates =
    compareMode === 'selectedDays' && compareEffectiveFrom
      ? compareEffectiveFrom
      : dateFrom && dateTo
        ? `${dateFrom} → ${dateTo}`
        : '—'
  const periodBDates =
    compareMode === 'selectedDays' && compareEffectiveTo
      ? compareEffectiveTo
      : compareEffectiveFrom && compareEffectiveTo
        ? `${compareEffectiveFrom} → ${compareEffectiveTo}`
        : '—'

  const chartData =
    displayPrimary && comp
      ? [
          { metric: 'Items', A: displayPrimary.totalItemsPacked, B: comp.totalItemsPacked },
          {
            metric: 'Manuren',
            A: Math.round(displayPrimary.totalManHours * 10) / 10,
            B: Math.round(comp.totalManHours * 10) / 10,
          },
          {
            metric: 'Omzet (k€)',
            A: Math.round((displayPrimary.totalRevenue / 1000) * 10) / 10,
            B: Math.round((comp.totalRevenue / 1000) * 10) / 10,
          },
        ]
      : []

  return (
    <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-md">
            <GitCompareArrows className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Periode-analyse & vergelijking</h2>
            <p className="text-sm text-gray-600 mt-0.5 max-w-2xl">
              Zet twee periodes naast elkaar met één klik, of gebruik onderaan &quot;Vergelijking inschakelen&quot;. De
              grafiek toont absolute waarden (omzet in duizend €).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onApplyComparePreset(key)}
              className="text-xs font-semibold text-indigo-800 bg-white border border-indigo-200 rounded-full px-3 py-1.5 hover:bg-indigo-50 shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!totals ? (
        <p className="text-sm text-gray-500">Laad eerst data via Vernieuwen.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div
            className={`rounded-xl border bg-white/90 p-4 shadow-sm ${
              compareEnabled && comp ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 text-indigo-700">
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wide">{periodALabel}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3 font-mono">{periodADates}</p>
            <StatLine label="Kalenderdagen in selectie" value={String(displayPrimary?.totalDays ?? '—')} />
            <StatLine label="Items verpakt" value={displayPrimary?.totalItemsPacked.toLocaleString('nl-NL') ?? '—'} />
            <StatLine label="Manuren" value={`${(displayPrimary?.totalManHours ?? 0).toFixed(2)} u`} />
            <StatLine label="Omzet" value={formatCurrency(displayPrimary?.totalRevenue ?? 0)} />
            <StatLine label="Items / FTE (gem.)" value={`${(displayPrimary?.averageItemsPerFte ?? 0).toFixed(2)}`} />
          </div>

          {compareEnabled && comp && displayPrimary ? (
            <>
              <div className="rounded-xl border border-violet-200 bg-white/90 p-4 shadow-sm ring-1 ring-violet-100">
                <div className="flex items-center gap-2 mb-3 text-violet-700">
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide">{periodBLabel}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 font-mono">{periodBDates}</p>
                <StatLine label="Kalenderdagen in selectie" value={String(comp.totalDays)} />
                <StatLine label="Items verpakt" value={comp.totalItemsPacked.toLocaleString('nl-NL')} />
                <StatLine label="Manuren" value={`${comp.totalManHours.toFixed(2)} u`} />
                <StatLine label="Omzet" value={formatCurrency(comp.totalRevenue)} />
                <StatLine label="Items / FTE (gem.)" value={`${comp.averageItemsPerFte.toFixed(2)}`} />
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
                          name === 'A' ? periodALabel : periodBLabel,
                        ]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Legend formatter={(value) => (value === 'A' ? periodALabel : periodBLabel)} />
                      <Bar dataKey="A" name="A" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="B" name="B" fill="#7c3aed" radius={[4, 4, 0, 0]} />
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
                Klik op een preset hierboven of schakel vergelijking in bij Filters (vorige periode / vorig jaar / twee
                dagen).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
