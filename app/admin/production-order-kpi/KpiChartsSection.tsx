'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyFinancial, DailyHours, KpiData } from './types'
import { formatDateShort, formatEuro, formatHours } from './kpi-formatters'

const chartTooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 12,
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-gray-400">{label}</div>
  )
}

function RankedBarChart({
  data,
  emptyLabel,
  color,
}: {
  data: { name: string; hours: number }[]
  emptyLabel: string
  color: string
}) {
  if (data.length === 0) return <EmptyChart label={emptyLabel} />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v}u`} fontSize={11} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={chartTooltipStyle}
          formatter={(value) => [formatHours(Number(value)), 'Uren']}
        />
        <Bar dataKey="hours" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function KpiChartsSection({
  kpiData,
  dailyHours,
  dailyFinancial,
}: {
  kpiData: KpiData | null
  dailyHours: DailyHours[]
  dailyFinancial: DailyFinancial[]
}) {
  const topSteps = (kpiData?.steps ?? []).slice(0, 8).map((s) => ({
    name: s.key.length > 18 ? `${s.key.slice(0, 18)}…` : s.key,
    hours: s.hours,
  }))

  const topEmployees = (kpiData?.employees ?? []).slice(0, 8).map((e) => ({
    name: e.key.length > 16 ? `${e.key.slice(0, 16)}…` : e.key,
    hours: e.hours,
  }))

  const zaagData = (kpiData?.zaagByDate ?? []).map((z) => ({
    date: formatDateShort(z.date),
    hours: z.hours,
  }))

  const hoursTrend = dailyHours.map((d) => ({
    date: formatDateShort(d.date),
    uren: Number(d.hours.toFixed(2)),
  }))

  const financialTrend = dailyFinancial.map((d) => ({
    date: formatDateShort(d.date),
    opbrengst: Number(d.revenue.toFixed(2)),
    marge: Number(d.margin.toFixed(2)),
    uren: Number(d.hours.toFixed(2)),
  }))

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Uren per dag</h3>
        <p className="text-xs text-gray-500 mb-4">Totale productie-uren in de geselecteerde periode</p>
        {hoursTrend.length === 0 ? (
          <EmptyChart label="Geen uren in deze periode" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={hoursTrend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v}u`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [formatHours(Number(v)), 'Uren']} />
              <Bar dataKey="uren" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Opbrengst &amp; marge per dag</h3>
        <p className="text-xs text-gray-500 mb-4">Financiële evolutie op basis van geregistreerde runs</p>
        {financialTrend.length === 0 ? (
          <EmptyChart label="Geen financiële data in deze periode" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={financialTrend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `€${v}`} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [
                  name === 'uren' ? formatHours(Number(value)) : formatEuro(Number(value)),
                  name === 'opbrengst' ? 'Opbrengst' : name === 'marge' ? 'Marge' : 'Uren',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="opbrengst" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="marge" stroke="#0d9488" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Uren per stap (top 8)</h3>
        <p className="text-xs text-gray-500 mb-4">Waar de meeste tijd naartoe gaat</p>
        <RankedBarChart data={topSteps} emptyLabel="Geen stappen geregistreerd" color="#8b5cf6" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Uren per medewerker (top 8)</h3>
        <p className="text-xs text-gray-500 mb-4">Productiviteit per persoon</p>
        <RankedBarChart data={topEmployees} emptyLabel="Geen medewerkers geregistreerd" color="#f59e0b" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 xl:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Zaag-uren per dag</h3>
        <p className="text-xs text-gray-500 mb-4">Stappen met &quot;zaag&quot; of &quot;zagen&quot; in de naam</p>
        {zaagData.length === 0 ? (
          <EmptyChart label="Geen zaag-uren in deze periode" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={zaagData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v}u`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [formatHours(Number(v)), 'Zaag-uren']} />
              <Bar dataKey="hours" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
