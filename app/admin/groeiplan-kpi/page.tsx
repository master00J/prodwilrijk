'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'
import {
  KPI_CATEGORY_LABELS,
  type KpiCategory,
  type KpiReadiness,
} from '@/lib/kpi/groeiplan-registry'
import type { GroeiplanKpiReport, KpiAnalysisResult, TrendDirection } from '@/lib/kpi/groeiplan-compute'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const READINESS_LABELS: Record<KpiReadiness, string> = {
  operational: 'Operationeel',
  partial: 'Gedeeltelijk',
  needs_data: 'Data ontbreekt',
}

const READINESS_COLORS: Record<KpiReadiness, string> = {
  operational: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  needs_data: 'bg-gray-100 text-gray-600 border-gray-200',
}

const TREND_LABELS: Record<TrendDirection, string> = {
  up: 'Stijging',
  down: 'Daling',
  stable: 'Stabiel',
  unknown: 'Onbekend',
}

const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'text-emerald-700',
  down: 'text-rose-700',
  stable: 'text-gray-600',
  unknown: 'text-gray-400',
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit' })
}

function KpiCard({ kpi, defaultOpen }: { kpi: KpiAnalysisResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const chartData = kpi.series.map((p) => ({
    month: p.month,
    label: formatMonthLabel(p.month),
    value: p.value,
    quality: p.dataQuality,
  }))
  const avg =
    chartData.filter((d) => d.value != null).reduce((s, d) => s + (d.value || 0), 0) /
      Math.max(1, chartData.filter((d) => d.value != null).length) || 0

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex flex-wrap items-start justify-between gap-3 hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
              {KPI_CATEGORY_LABELS[kpi.definition.category]}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border ${READINESS_COLORS[kpi.effectiveReadiness]}`}
            >
              {READINESS_LABELS[kpi.effectiveReadiness]}
            </span>
            {kpi.trend !== 'unknown' && (
              <span className={`text-xs font-semibold ${TREND_COLORS[kpi.trend]}`}>
                {TREND_LABELS[kpi.trend]}
                {kpi.trendPct != null ? ` (${kpi.trendPct > 0 ? '+' : ''}${kpi.trendPct}%)` : ''}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{kpi.definition.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{kpi.definition.description}</p>
        </div>
        <span className="text-gray-400 text-sm shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 space-y-4">
          {kpi.effectiveReadiness !== 'needs_data' && chartData.some((d) => d.value != null) ? (
            <div className="h-56 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value ?? 0).toLocaleString('nl-BE')} ${kpi.definition.unit}`,
                      kpi.definition.name,
                    ]}
                  />
                  {avg > 0 && (
                    <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" label="gem." />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic mt-4">
              Geen maandelijkse reeks beschikbaar — databron ontbreekt of is nog niet geactiveerd.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Interpretatie</div>
              <p className="text-gray-800">{kpi.interpretation}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-indigo-600 uppercase mb-1">Verwachte trend</div>
              <p className="text-gray-800">{kpi.forecast}</p>
            </div>
          </div>

          {(kpi.peak || kpi.trough) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {kpi.peak && (
                <span>
                  Piek: <strong>{formatMonthLabel(kpi.peak.month)}</strong> —{' '}
                  {kpi.peak.value.toLocaleString('nl-BE')} {kpi.definition.unit}
                </span>
              )}
              {kpi.trough && kpi.trough.month !== kpi.peak?.month && (
                <span>
                  Dal: <strong>{formatMonthLabel(kpi.trough.month)}</strong> —{' '}
                  {kpi.trough.value.toLocaleString('nl-BE')} {kpi.definition.unit}
                </span>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-medium">Databron:</span> {kpi.definition.dataSource}
            </div>
            {kpi.definition.groeiplanRef && (
              <div>
                <span className="font-medium">Groeiplan:</span> {kpi.definition.groeiplanRef}
              </div>
            )}
            {kpi.definition.relatedAdmin && (
              <div>
                <Link href={kpi.definition.relatedAdmin} className="text-indigo-600 underline">
                  Detaildashboard →
                </Link>
              </div>
            )}
          </div>

          {kpi.dataQualityNotes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-semibold text-amber-800 uppercase mb-2">
                Datakwaliteit & gaps
              </div>
              <ul className="text-sm text-amber-900 list-disc pl-4 space-y-1">
                {kpi.dataQualityNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GroeiplanKpiPage() {
  const [report, setReport] = useState<GroeiplanKpiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<KpiCategory | 'all'>('all')
  const [readinessFilter, setReadinessFilter] = useState<KpiReadiness | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/groeiplan-kpi', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error('Laden mislukt')
      setReport(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!report) return []
    return report.kpis.filter((k) => {
      if (category !== 'all' && k.definition.category !== category) return false
      if (readinessFilter !== 'all' && k.effectiveReadiness !== readinessFilter) return false
      return true
    })
  }, [report, category, readinessFilter])

  const categories = Object.keys(KPI_CATEGORY_LABELS) as KpiCategory[]

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Groeiplan KPI-overzicht</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">
              Managementdashboard voor periodieke opvolging van het strategisch groeiplan Foresco
              Wilrijk/Willebroek. KPI&apos;s worden toegepast op beschikbare ProdWilrijk-data met
              maandelijkse evolutie vanaf januari 2026.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? 'Laden…' : 'Vernieuwen'}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              {[
                { label: 'Totaal KPI\'s', value: report.summary.total, color: 'bg-gray-50' },
                { label: 'Operationeel', value: report.summary.operational, color: 'bg-emerald-50' },
                { label: 'Gedeeltelijk', value: report.summary.partial, color: 'bg-amber-50' },
                { label: 'Data ontbreekt', value: report.summary.needsData, color: 'bg-gray-100' },
                {
                  label: 'Kwaliteitsissues',
                  value: report.summary.withQualityIssues,
                  color: 'bg-orange-50',
                },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border border-gray-200 p-4 ${card.color}`}>
                  <div className="text-2xl font-bold tabular-nums">{card.value}</div>
                  <div className="text-xs text-gray-600 mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 mb-8 text-sm text-indigo-950">
              <h2 className="font-semibold mb-2">Leeswijzer voor management</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Operationeel</strong> — maandelijks meetbaar en opvolgbaar via ProdWilrijk.
                </li>
                <li>
                  <strong>Gedeeltelijk</strong> — data beschikbaar maar met gaps, onvolledige registratie
                  of beperkte dekking.
                </li>
                <li>
                  <strong>Data ontbreekt</strong> — bijkomende dataverzameling of module nodig (bv.
                  veiligheid, OTIF, planning vs realisatie).
                </li>
              </ul>
              <p className="mt-3 text-indigo-800">
                Periode: {report.reportStart} → {report.reportEnd} · gegenereerd{' '}
                {new Date(report.generatedAt).toLocaleString('nl-BE')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as KpiCategory | 'all')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">Alle categorieën</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {KPI_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <select
                value={readinessFilter}
                onChange={(e) => setReadinessFilter(e.target.value as KpiReadiness | 'all')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">Alle statussen</option>
                <option value="operational">Operationeel</option>
                <option value="partial">Gedeeltelijk</option>
                <option value="needs_data">Data ontbreekt</option>
              </select>
            </div>

            <div className="space-y-4">
              {filtered.map((kpi, i) => (
                <KpiCard key={kpi.definition.id} kpi={kpi} defaultOpen={i < 2} />
              ))}
              {filtered.length === 0 && !loading && (
                <p className="text-gray-500 text-center py-8">Geen KPI&apos;s voor dit filter.</p>
              )}
            </div>

            <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold mb-3">Aanbevolen vervolgstappen</h2>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium text-emerald-800 mb-2">Direct bruikbaar</h3>
                  <ul className="list-disc pl-4 space-y-1">
                    {report.kpis
                      .filter((k) => k.effectiveReadiness === 'operational')
                      .slice(0, 6)
                      .map((k) => (
                        <li key={k.definition.id}>{k.definition.name}</li>
                      ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-amber-800 mb-2">Dataverzameling uitbreiden</h3>
                  <ul className="list-disc pl-4 space-y-1">
                    {report.kpis
                      .filter((k) => k.effectiveReadiness === 'needs_data')
                      .map((k) => (
                        <li key={k.definition.id}>
                          {k.definition.name}
                          {k.definition.gaps[0] ? ` — ${k.definition.gaps[0]}` : ''}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {loading && !report && (
          <div className="text-center py-16 text-gray-500">KPI-rapport opbouwen…</div>
        )}
      </div>
    </AdminGuard>
  )
}
