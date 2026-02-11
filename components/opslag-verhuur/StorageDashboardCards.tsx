'use client'

import { BarChart3, DollarSign, MapPin, Package, Users } from 'lucide-react'

type Props = {
  loading: boolean
  activeCustomersCount: number
  totalUsedM2: number
  totalRevenue: number
  totalCapacityM2: number
  occupancy: number | null
}

export default function StorageDashboardCards({
  loading,
  activeCustomersCount,
  totalUsedM2,
  totalRevenue,
  totalCapacityM2,
  occupancy,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-4 border border-gray-100 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4 text-blue-500" />
          Actieve klanten
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1">{activeCustomersCount}</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="w-4 h-4 text-amber-500" />
          Bezet m²
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1">{totalUsedM2.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign className="w-4 h-4 text-green-600" />
          Rendement
        </div>
        <div className="text-2xl font-semibold text-green-700 mt-1">
          {totalRevenue.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">Tot vandaag (geprorrateerd)</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Package className="w-4 h-4 text-indigo-500" />
          Capaciteit m²
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1">{totalCapacityM2.toFixed(2)}</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <BarChart3 className="w-4 h-4 text-purple-500" />
          Bezettingsgraad
        </div>
        <div className="text-2xl font-semibold text-gray-900 mt-1">
          {occupancy === null ? '-' : `${occupancy.toFixed(1)}%`}
        </div>
      </div>
    </div>
  )
}
