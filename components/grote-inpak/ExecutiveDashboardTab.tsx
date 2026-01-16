'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import type { GroteInpakCase } from '@/types/database'

interface ExecutiveDashboardTabProps {
  overview: GroteInpakCase[]
  transport: any[]
}

type BacklogHistoryItem = {
  snapshot_date: string
  backlog_overdue: number
}

const PIE_COLORS = ['#60A5FA', '#34D399', '#F59E0B', '#F87171']

export default function ExecutiveDashboardTab({ overview, transport }: ExecutiveDashboardTabProps) {
  const [backlogHistory, setBacklogHistory] = useState<BacklogHistoryItem[]>([])
  const [throughputRate, setThroughputRate] = useState<number>(0)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/grote-inpak/backlog-history')
        if (response.ok) {
          const result = await response.json()
          setBacklogHistory(result.data || [])
        }
      } catch (err) {
        console.warn('Could not load backlog history:', err)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    const loadThroughput = async () => {
      try {
        const dateFrom = new Date()
        dateFrom.setDate(dateFrom.getDate() - 30)
        const response = await fetch(`/api/grote-inpak/packed?date_from=${dateFrom.toISOString().split('T')[0]}`)
        if (!response.ok) return
        const result = await response.json()
        const packed = result.data || []
        const byDate = new Map<string, number>()
        packed.forEach((item: any) => {
          const date = item.packed_date || ''
          if (!date) return
          byDate.set(date, (byDate.get(date) || 0) + 1)
        })
        const totalDays = byDate.size || 1
        const totalPacked = Array.from(byDate.values()).reduce((sum, v) => sum + v, 0)
        setThroughputRate(totalPacked / totalDays)
      } catch (err) {
        console.warn('Could not calculate throughput:', err)
      }
    }
    loadThroughput()
  }, [])

  const metrics = useMemo(() => {
    const totalCases = overview.length
    const inWillebroek = overview.filter(item => item.in_willebroek).length
    const backlogOverdue = overview.filter(item => (item.dagen_te_laat || 0) > 0).length
    const transportCount = transport.length
    const priorityCases = overview.filter(item => item.priority).length
    const genkCases = overview.filter(item => item.productielocatie === 'Genk').length
    const wilrijkCases = overview.filter(item => item.productielocatie === 'Wilrijk').length
    const genkNotInWillebroek = overview.filter(item => item.productielocatie === 'Genk' && !item.in_willebroek).length
    const wilrijkNotInWillebroek = overview.filter(item => item.productielocatie === 'Wilrijk' && !item.in_willebroek).length
    const totalTransportNeeded = transportCount || (genkNotInWillebroek + wilrijkNotInWillebroek)
    const willebroekPercentage = totalCases > 0 ? (inWillebroek / totalCases) * 100 : 0

    return {
      totalCases,
      inWillebroek,
      backlogOverdue,
      priorityCases,
      genkCases,
      wilrijkCases,
      genkNotInWillebroek,
      wilrijkNotInWillebroek,
      totalTransportNeeded,
      willebroekPercentage,
    }
  }, [overview])

  const alerts = useMemo(() => {
    const backlogLevel =
      metrics.backlogOverdue > 25 ? 'danger' : metrics.backlogOverdue > 10 ? 'warning' : 'good'
    const transportLevel =
      metrics.totalTransportNeeded > 50 ? 'danger' : metrics.totalTransportNeeded > 20 ? 'warning' : 'good'
    return { backlogLevel, transportLevel }
  }, [metrics])

  const productionData = useMemo(() => {
    const grouped = overview.reduce((acc: Record<string, number>, item) => {
      const key = item.productielocatie || 'Onbekend'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [overview])

  const transportData = [
    {
      location: 'Genk',
      transport: metrics.genkNotInWillebroek,
      inWillebroek: Math.max(metrics.genkCases - metrics.genkNotInWillebroek, 0),
    },
    {
      location: 'Wilrijk',
      transport: metrics.wilrijkNotInWillebroek,
      inWillebroek: Math.max(metrics.wilrijkCases - metrics.wilrijkNotInWillebroek, 0),
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📊 Executive Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Totaal Cases</p>
          <p className="text-3xl font-bold">{metrics.totalCases.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">In Willebroek</p>
          <p className="text-3xl font-bold">{metrics.inWillebroek.toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Transport Nodig</p>
          <p className="text-3xl font-bold">{metrics.totalTransportNeeded.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Overdue Cases</p>
          <p className="text-3xl font-bold">{metrics.backlogOverdue.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Willebroek Coverage</p>
          <p className="text-2xl font-bold">{metrics.willebroekPercentage.toFixed(1)}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Throughput</p>
          <p className="text-2xl font-bold">{throughputRate.toFixed(1)} cases/dag</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Priority Cases</p>
          <p className="text-2xl font-bold">{metrics.priorityCases}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Forecast Changes</p>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8">
        <h3 className="text-lg font-semibold mb-3">🚨 Alerts & Notifications</h3>
        {alerts.backlogLevel !== 'good' && (
          <div className={`mb-2 ${alerts.backlogLevel === 'danger' ? 'text-red-700' : 'text-yellow-700'}`}>
            ⏰ Backlog {alerts.backlogLevel === 'danger' ? 'Critical' : 'Warning'} - {metrics.backlogOverdue} cases te laat
          </div>
        )}
        {alerts.transportLevel !== 'good' && (
          <div className={`mb-2 ${alerts.transportLevel === 'danger' ? 'text-red-700' : 'text-yellow-700'}`}>
            🚚 Transport {alerts.transportLevel === 'danger' ? 'Critical' : 'Warning'} - {metrics.totalTransportNeeded} cases
          </div>
        )}
        {alerts.backlogLevel === 'good' && alerts.transportLevel === 'good' && (
          <div className="text-green-700">✅ Alles onder controle</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Productie verdeling</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={productionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {productionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Transport status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transportData}>
                <XAxis dataKey="location" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="transport" name="Te transporteren" fill="#F97316" />
                <Bar dataKey="inWillebroek" name="In Willebroek" fill="#22C55E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">📈 Backlog trend</h3>
        {backlogHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen trenddata beschikbaar.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={backlogHistory}>
                <XAxis dataKey="snapshot_date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="backlog_overdue" name="Backlog" stroke="#EF4444" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

