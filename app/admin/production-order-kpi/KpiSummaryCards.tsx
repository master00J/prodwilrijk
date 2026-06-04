'use client'

import type { ReactNode } from 'react'
import {
  Activity,
  Boxes,
  Clock,
  Euro,
  Gauge,
  Layers,
  Package,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'
import type { DerivedKpis } from './types'
import {
  formatEuro,
  formatHours,
  formatPct,
  intFormatter,
  marginColorClass,
} from './kpi-formatters'

type CardDef = {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  accent: string
  valueClass?: string
}

function KpiTile({ card }: { card: CardDef }) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${card.accent.split(' ')[0]}`}>
      <div className={`mb-2 inline-flex rounded-lg p-2 ${card.accent}`}>{card.icon}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</div>
      <div className={`mt-1 text-xl font-bold ${card.valueClass || 'text-gray-900'}`}>{card.value}</div>
      {card.sub ? <div className="mt-1 text-xs text-gray-500">{card.sub}</div> : null}
    </div>
  )
}

export function KpiSummaryCards({ derived }: { derived: DerivedKpis }) {
  const financial: CardDef[] = [
    {
      label: 'Totale opbrengst',
      value: formatEuro(derived.totalRevenue),
      icon: <Euro className="h-5 w-5" />,
      accent: 'border-green-500 bg-green-50 text-green-700',
    },
    {
      label: 'Materiaalkost',
      value: formatEuro(derived.totalMaterialCost),
      icon: <Package className="h-5 w-5" />,
      accent: 'border-amber-500 bg-amber-50 text-amber-700',
    },
    {
      label: 'Marge (€)',
      value: formatEuro(derived.totalMargin),
      sub: derived.marginPctOverall != null ? `${formatPct(derived.marginPctOverall)} marge` : undefined,
      icon: <TrendingUp className="h-5 w-5" />,
      accent:
        derived.marginPctOverall != null && derived.marginPctOverall < 0
          ? 'border-red-500 bg-red-50 text-red-700'
          : 'border-emerald-600 bg-emerald-50 text-emerald-700',
      valueClass: marginColorClass(derived.marginPctOverall),
    },
    {
      label: '€ per uur',
      value: derived.revPerHourOverall != null ? formatEuro(derived.revPerHourOverall) : '–',
      sub: 'Opbrengst / gepresteerde uren',
      icon: <Gauge className="h-5 w-5" />,
      accent: 'border-indigo-500 bg-indigo-50 text-indigo-700',
    },
  ]

  const operational: CardDef[] = [
    {
      label: 'Gepresteerde uren',
      value: formatHours(derived.totalHours),
      sub: `${derived.runCount} productieruns`,
      icon: <Clock className="h-5 w-5" />,
      accent: 'border-blue-500 bg-blue-50 text-blue-700',
    },
    {
      label: 'Geproduceerde stuks',
      value: intFormatter.format(derived.totalQuantity),
      sub: `${derived.uniqueOrders} orders`,
      icon: <Boxes className="h-5 w-5" />,
      accent: 'border-violet-500 bg-violet-50 text-violet-700',
    },
    {
      label: 'Gem. uren per stuk',
      value: formatHours(derived.avgHoursPerPiece),
      sub: `${derived.uniqueItems} unieke items`,
      icon: <Activity className="h-5 w-5" />,
      accent: 'border-purple-500 bg-purple-50 text-purple-700',
    },
    {
      label: 'Medewerkers actief',
      value: String(derived.uniqueEmployees),
      sub: `${derived.activeStepCount} verschillende stappen`,
      icon: <Users className="h-5 w-5" />,
      accent: 'border-teal-600 bg-teal-50 text-teal-700',
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {financial.map((card) => (
          <KpiTile key={card.label} card={card} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {operational.map((card) => (
          <KpiTile key={card.label} card={card} />
        ))}
      </div>
    </div>
  )
}

export function KpiSecondaryStats({ derived }: { derived: DerivedKpis }) {
  const stats = [
    { label: 'Productieruns', value: String(derived.runCount), icon: Layers },
    { label: 'Orders', value: String(derived.uniqueOrders), icon: Boxes },
    { label: 'Items', value: String(derived.uniqueItems), icon: Activity },
    { label: 'Medewerkers', value: String(derived.uniqueEmployees), icon: Users },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-100"
        >
          <Icon className="h-4 w-4 text-gray-400 shrink-0" />
          <div>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="font-semibold text-gray-900">{value}</div>
          </div>
        </div>
      ))}
      <div className="col-span-2 md:col-span-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-1">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
          Marge ≥ 15 %
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />
          Marge 0 – 15 %
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
          Marge negatief
        </span>
      </div>
    </div>
  )
}
