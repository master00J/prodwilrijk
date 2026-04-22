'use client'

import { BarChart3, DollarSign, MapPin, Package, Users } from 'lucide-react'

type Props = {
  loading: boolean
  activeCustomersCount: number
  totalCustomersCount: number
  totalUsedM2: number
  totalRevenue: number
  revenueThisMonth: number
  totalCapacityM2: number
  occupancy: number | null
}

const eur = (v: number) =>
  v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

function occupancyColor(pct: number): { bar: string; text: string } {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700' }
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-700' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
}

export default function StorageDashboardCards({
  loading,
  activeCustomersCount,
  totalCustomersCount,
  totalUsedM2,
  totalRevenue,
  revenueThisMonth,
  totalCapacityM2,
  occupancy,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-28" />
          </div>
        ))}
      </div>
    )
  }

  const occ = occupancy ?? 0
  const occColors = occupancyColor(occ)
  const occBarWidth = Math.min(100, Math.max(0, occ))

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Actieve klanten */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4 text-blue-500" />
          Actieve klanten
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
          {activeCustomersCount}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          van {totalCustomersCount} totaal
        </div>
      </div>

      {/* Bezettingsgraad met progress-bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <BarChart3 className="w-4 h-4 text-purple-500" />
          Bezettingsgraad
        </div>
        <div className={`text-2xl font-semibold mt-1 tabular-nums ${occColors.text}`}>
          {occupancy === null ? '–' : `${occupancy.toFixed(1)}%`}
        </div>
        <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${occColors.bar} transition-all`}
            style={{ width: `${occBarWidth}%` }}
            role="progressbar"
            aria-valuenow={occ}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Capaciteit: bezet / totaal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Package className="w-4 h-4 text-indigo-500" />
          Capaciteit
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
          <span className="text-indigo-600">{totalUsedM2.toFixed(0)}</span>
          <span className="text-gray-400 text-lg"> / {totalCapacityM2.toFixed(0)}</span>
          <span className="text-gray-400 text-base font-normal"> m²</span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Bezet vs. beschikbaar
        </div>
      </div>

      {/* Rendement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign className="w-4 h-4 text-green-600" />
          Rendement
        </div>
        <div className="text-2xl font-semibold text-green-700 mt-1 tabular-nums">
          {eur(totalRevenue)}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Deze maand:{' '}
          <span className="text-gray-600 font-medium">{eur(revenueThisMonth)}</span>
        </div>
      </div>
    </div>
  )
}
