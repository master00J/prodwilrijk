'use client'

import { useMemo } from 'react'
import type { GroteInpakCase } from '@/types/database'

interface ExecutiveDashboardTabProps {
  overview: GroteInpakCase[]
  transport: any[]
}

export default function ExecutiveDashboardTab({ overview, transport }: ExecutiveDashboardTabProps) {
  const metrics = useMemo(() => {
    const totalCases = overview.length
    const inWillebroek = overview.filter(item => item.in_willebroek).length
    const transportNeeded = transport.length
    const backlogOverdue = overview.filter(item => item.dagen_te_laat > 0).length
    const priorityCases = overview.filter(item => item.priority).length

    return {
      totalCases,
      inWillebroek,
      transportNeeded,
      backlogOverdue,
      priorityCases,
    }
  }, [overview, transport])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📊 Executive Dashboard</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-1">Totaal Cases</p>
          <p className="text-4xl font-bold">{metrics.totalCases.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-1">In Willebroek</p>
          <p className="text-4xl font-bold">{metrics.inWillebroek.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-1">Transport Nodig</p>
          <p className="text-4xl font-bold">{metrics.transportNeeded.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-1">Overdue</p>
          <p className="text-4xl font-bold">{metrics.backlogOverdue}</p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Priority Cases</h3>
          <p className="text-3xl font-bold text-yellow-600">{metrics.priorityCases}</p>
          <p className="text-sm text-gray-500 mt-2">
            {metrics.totalCases > 0 
              ? `${((metrics.priorityCases / metrics.totalCases) * 100).toFixed(1)}% van totaal`
              : '0% van totaal'
            }
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Transport Efficiency</h3>
          <p className="text-3xl font-bold text-blue-600">
            {metrics.totalCases > 0
              ? `${((metrics.transportNeeded / metrics.totalCases) * 100).toFixed(1)}%`
              : '0%'
            }
          </p>
          <p className="text-sm text-gray-500 mt-2">Percentage cases die transport nodig hebben</p>
        </div>
      </div>
    </div>
  )
}

