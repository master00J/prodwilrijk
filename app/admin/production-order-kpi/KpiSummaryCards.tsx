'use client'

import type { ReactNode } from 'react'
import {
  Activity,
  Boxes,
  Clock,
  Euro,
  Layers,
  Package,
  Percent,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'
import type { DerivedKpis, RevenueTotals } from './types'
import { formatEuro, formatHours, formatPct } from './kpi-formatters'

type CardDef = {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  accent: string
}

export function KpiSummaryCards({
  totals,
  derived,
}: {
  totals: RevenueTotals | null
  derived: DerivedKpis
}) {
  const cards: CardDef[] = [
    {
      label: 'Totale opbrengst',
      value: formatEuro(totals?.total_revenue ?? 0),
      sub: derived.avgRevenuePerRun != null ? `Gem. ${formatEuro(derived.avgRevenuePerRun)} per run` : undefined,
      icon: <Euro className="h-5 w-5" />,
      accent: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Materiaalkost',
      value: formatEuro(totals?.total_material_cost ?? 0),
      sub: derived.materialPct != null ? `${formatPct(derived.materialPct)} van opbrengst` : undefined,
      icon: <Package className="h-5 w-5" />,
      accent: 'border-amber-500 bg-amber-50 text-amber-700',
    },
    {
      label: 'Bruto marge',
      value: formatEuro(totals?.total_margin ?? 0),
      sub: derived.marginPct != null ? `${formatPct(derived.marginPct)} marge` : undefined,
      icon: <TrendingUp className="h-5 w-5" />,
      accent: 'border-teal-600 bg-teal-50 text-teal-700',
    },
    {
      label: 'Gepresteerde uren',
      value: `${(totals?.total_hours ?? 0).toFixed(1)} u`,
      sub: derived.revenuePerHour != null ? `${formatEuro(derived.revenuePerHour)}/u opbrengst` : undefined,
      icon: <Clock className="h-5 w-5" />,
      accent: 'border-blue-500 bg-blue-50 text-blue-700',
    },
    {
      label: 'Geproduceerde stuks',
      value: derived.totalQuantity.toLocaleString('nl-BE'),
      sub: `${derived.runCount} productieruns`,
      icon: <Boxes className="h-5 w-5" />,
      accent: 'border-violet-500 bg-violet-50 text-violet-700',
    },
    {
      label: 'Gem. uren per stuk',
      value: formatHours(derived.avgHoursPerPiece),
      sub: derived.marginPerHour != null ? `${formatEuro(derived.marginPerHour)}/u marge` : undefined,
      icon: <Activity className="h-5 w-5" />,
      accent: 'border-indigo-500 bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Orders / items / medewerkers',
      value: `${derived.uniqueOrders} / ${derived.uniqueItems} / ${derived.uniqueEmployees}`,
      sub: `${derived.activeStepCount} actieve stappen`,
      icon: <Layers className="h-5 w-5" />,
      accent: 'border-slate-500 bg-slate-50 text-slate-700',
    },
    {
      label: 'Zaag-uren',
      value: formatHours(derived.zaagHours),
      sub: 'Stappen met zaag/zagen',
      icon: <Wrench className="h-5 w-5" />,
      accent: 'border-orange-500 bg-orange-50 text-orange-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${card.accent.split(' ')[0]}`}
        >
          <div className={`mb-2 inline-flex rounded-lg p-2 ${card.accent}`}>{card.icon}</div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</div>
          <div className="mt-1 text-xl font-bold text-gray-900">{card.value}</div>
          {card.sub ? <div className="mt-1 text-xs text-gray-500">{card.sub}</div> : null}
        </div>
      ))}
    </div>
  )
}

export function KpiSecondaryStats({ derived }: { derived: DerivedKpis }) {
  const stats = [
    { label: 'Marge %', value: formatPct(derived.marginPct), icon: Percent },
    { label: 'Materiaal %', value: formatPct(derived.materialPct), icon: Percent },
    { label: 'Opbrengst/u', value: formatEuro(derived.revenuePerHour), icon: Euro },
    { label: 'Medewerkers actief', value: String(derived.uniqueEmployees), icon: Users },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-100">
          <Icon className="h-4 w-4 text-gray-400 shrink-0" />
          <div>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="font-semibold text-gray-900">{value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
