'use client'

// Dashboard-tab voor grote inpak: cockpit met live KPI's per locatie,
// trends over tijd, doorlooptijd-statistiek en forecast-betrouwbaarheid.

import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  Package,
  Star,
  Clock,
  MessageSquareWarning,
  TrendingUp,
  TrendingDown,
  Minus,
  Timer,
  CalendarClock,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

type LocationKpi = {
  location: string
  total_cases: number
  priority_cases: number
  overdue_cases: number
  overdue_1_3: number
  overdue_4_7: number
  overdue_8_plus: number
  forecast_kritiek: number
  avg_ligtijd_dagen: number | null
}

type DashboardData = {
  generated_at: string
  locations: LocationKpi[]
  week_delta: {
    compared_to: string
    total_cases: number
    priority_cases: number
    overdue_cases: number
    avg_ligtijd_dagen: number | null
  } | null
  trend: Array<{ date: string; total: number | null; overdue: number | null; priority: number | null }>
  doorlooptijd: {
    window_days: number
    count: number
    avg: number | null
    median: number | null
    per_location: Array<{ location: string; count: number; avg: number }>
    per_case_type: Array<{ case_type: string; count: number; avg: number; max: number }>
    outliers: Array<{
      case_label: string
      case_type: string | null
      productielocatie: string | null
      doorlooptijd: number
      removed_at: string
    }>
  }
  forecast_reliability: Array<{
    case_type: string
    cases: number
    shifted_cases: number
    shifted_pct: number
    avg_changes: number
    avg_shift_days: number
  }>
  customer_requests: {
    open_total: number
    by_status: Record<string, number>
  }
}

function DeltaBadge({ value, invert = false, suffix = '' }: { value: number | null | undefined; invert?: boolean; suffix?: string }) {
  if (value == null) return null
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
        <Minus className="w-3 h-3" /> gelijk
      </span>
    )
  }
  // invert: stijging is slecht (bv. te laat) → rood bij +
  const up = value > 0
  const good = invert ? !up : up
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        good ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{value}{suffix} vs vorige week
    </span>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  delta,
}: {
  label: string
  value: string | number
  sub?: React.ReactNode
  icon: React.ReactNode
  accent: string
  delta?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  waiting_forecast: 'Wacht op forecast',
  on_pils: 'Op PILS',
}

export default function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/grote-inpak/dashboard')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Dashboard laden mislukt')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Dashboard laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Dashboard laden...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Opnieuw proberen
        </button>
      </div>
    )
  }

  if (!data) return null

  const totaal = data.locations.find((l) => l.location === 'Totaal')
  const perLocatie = data.locations
    .filter((l) => l.location !== 'Totaal')
    .sort((a, b) => b.total_cases - a.total_cases)
  const trendData = data.trend.map((row) => ({
    ...row,
    dateLabel: row.date.slice(5).split('-').reverse().join('/'),
  }))
  const hasTrend = trendData.length >= 2

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📊 Dashboard</h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      {/* KPI-kaarten */}
      {totaal && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Op PILS"
            value={totaal.total_cases}
            sub={perLocatie.map((l) => `${l.location}: ${l.total_cases}`).join(' · ')}
            icon={<Package className="w-5 h-5" />}
            accent="text-blue-600"
            delta={<DeltaBadge value={data.week_delta?.total_cases} />}
          />
          <KpiCard
            label="Prio"
            value={totaal.priority_cases}
            sub={perLocatie.map((l) => `${l.location}: ${l.priority_cases}`).join(' · ')}
            icon={<Star className="w-5 h-5" />}
            accent="text-amber-500"
            delta={<DeltaBadge value={data.week_delta?.priority_cases} invert />}
          />
          <KpiCard
            label="Te laat"
            value={totaal.overdue_cases}
            sub={
              <span className="flex flex-wrap gap-1">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">1–3d: {totaal.overdue_1_3}</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">4–7d: {totaal.overdue_4_7}</span>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800">8+d: {totaal.overdue_8_plus}</span>
              </span>
            }
            icon={<Clock className="w-5 h-5" />}
            accent={totaal.overdue_cases > 0 ? 'text-red-600' : 'text-gray-400'}
            delta={<DeltaBadge value={data.week_delta?.overdue_cases} invert />}
          />
          <KpiCard
            label="Gem. ligtijd op PILS"
            value={totaal.avg_ligtijd_dagen != null ? `${totaal.avg_ligtijd_dagen}d` : '—'}
            sub={perLocatie
              .filter((l) => l.avg_ligtijd_dagen != null)
              .map((l) => `${l.location}: ${l.avg_ligtijd_dagen}d`)
              .join(' · ')}
            icon={<Timer className="w-5 h-5" />}
            accent="text-violet-600"
            delta={<DeltaBadge value={data.week_delta?.avg_ligtijd_dagen} invert suffix="d" />}
          />
          <KpiCard
            label="Open klantvragen"
            value={data.customer_requests.open_total}
            sub={Object.entries(data.customer_requests.by_status)
              .map(([status, count]) => `${STATUS_LABELS[status] || status}: ${count}`)
              .join(' · ')}
            icon={<MessageSquareWarning className="w-5 h-5" />}
            accent={data.customer_requests.open_total > 0 ? 'text-orange-600' : 'text-gray-400'}
          />
        </div>
      )}

      {/* Trend over tijd */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" /> Evolutie laatste 60 dagen
        </h3>
        {hasTrend ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Op PILS" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="overdue" name="Te laat" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="priority" name="Prio" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-6">
            Nog onvoldoende historiek. De trend wordt opgebouwd bij elke PILS-verwerking (1 punt per dag).
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doorlooptijd */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Timer className="w-5 h-5 text-violet-600" /> Doorlooptijd verpakte units
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            PILS-aankomst → van PILS verdwenen, laatste {data.doorlooptijd.window_days} dagen ({data.doorlooptijd.count} units)
          </p>
          {data.doorlooptijd.count === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              Nog geen verpakte units geregistreerd. Dit vult zich automatisch vanaf de volgende PILS-verwerkingen.
            </p>
          ) : (
            <>
              <div className="flex gap-6 mb-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{data.doorlooptijd.avg}d</div>
                  <div className="text-xs text-gray-500">gemiddeld</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{data.doorlooptijd.median}d</div>
                  <div className="text-xs text-gray-500">mediaan</div>
                </div>
                {data.doorlooptijd.per_location.map((row) => (
                  <div key={row.location}>
                    <div className="text-2xl font-bold text-gray-900">{row.avg}d</div>
                    <div className="text-xs text-gray-500">{row.location} ({row.count})</div>
                  </div>
                ))}
              </div>
              {data.doorlooptijd.per_case_type.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-1.5">Kisttype (traagste eerst)</th>
                      <th className="py-1.5 text-right"># verpakt</th>
                      <th className="py-1.5 text-right">Gem.</th>
                      <th className="py-1.5 text-right">Max.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doorlooptijd.per_case_type.map((row) => (
                      <tr key={row.case_type} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{row.case_type}</td>
                        <td className="py-1.5 text-right">{row.count}</td>
                        <td className="py-1.5 text-right">{row.avg}d</td>
                        <td className="py-1.5 text-right text-red-600">{row.max}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.doorlooptijd.outliers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">Langste doorlooptijden:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.doorlooptijd.outliers.map((row) => (
                      <span
                        key={`${row.case_label}-${row.removed_at}`}
                        className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-xs text-red-800"
                        title={`${row.case_type || ''} ${row.productielocatie || ''}`}
                      >
                        {row.case_label}: {row.doorlooptijd}d
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Forecast-betrouwbaarheid */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-orange-600" /> Forecast-betrouwbaarheid per kisttype
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Hoe vaak schuift de forecastdatum op, en hoeveel dagen in totaal (eerste vs laatste datum)?
          </p>
          {data.forecast_reliability.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">Nog geen forecast-wijzigingen geregistreerd.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-1.5">Kisttype</th>
                  <th className="py-1.5 text-right"># units</th>
                  <th className="py-1.5 text-right">% geschoven</th>
                  <th className="py-1.5 text-right">Gem. # wijz.</th>
                  <th className="py-1.5 text-right">Gem. verschuiving</th>
                </tr>
              </thead>
              <tbody>
                {data.forecast_reliability.map((row) => (
                  <tr key={row.case_type} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium">{row.case_type || 'Onbekend'}</td>
                    <td className="py-1.5 text-right">{row.cases}</td>
                    <td className="py-1.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          row.shifted_pct >= 50
                            ? 'bg-red-100 text-red-800'
                            : row.shifted_pct >= 25
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.shifted_pct}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right">{row.avg_changes}</td>
                    <td className="py-1.5 text-right">{row.avg_shift_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Forecast-kritiek per locatie */}
      {totaal && totaal.forecast_kritiek > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          ⚠️ {totaal.forecast_kritiek} unit(s) staan op de PILS vóór hun forecastdatum
          {perLocatie.filter((l) => l.forecast_kritiek > 0).map((l) => ` — ${l.location}: ${l.forecast_kritiek}`)}
          . Kisten zijn daar mogelijk nog niet klaar.
        </div>
      )}

      <p className="text-xs text-gray-400">
        Gegenereerd: {new Date(data.generated_at).toLocaleString('nl-BE')} — KPI&apos;s zijn live; trends, doorlooptijd
        en betrouwbaarheid worden opgebouwd bij elke PILS-verwerking.
      </p>
    </div>
  )
}
