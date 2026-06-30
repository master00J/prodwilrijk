'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts'
import PeriodCompareCard, { type CompareTotals } from '@/components/admin/shared/PeriodCompareCard'
import {
  getComparePreset,
  getPreviousPeriodRange,
  toDateInput,
  type ComparePresetKey,
} from '@/lib/utils/periodPresets'

interface PrepackDailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerFte: number
  revenue: number
  materialCost: number
  incomingItems: number
  fte: number
}

interface PrepackTotals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalMaterialCost: number
  totalIncoming: number
  incomingVsPackedRatio: number | null
  avgLeadTimeHours: number | null
  totalFte: number
  avgFtePerDay: number
}

interface AirtecDailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerFte: number
  revenue: number
  materialCost: number
  incomingItems: number
  fte: number
}

interface AirtecTotals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalMaterialCost: number
  totalIncoming: number
  incomingVsPackedRatio: number | null
  avgLeadTimeHours: number | null
  totalFte: number
  avgFtePerDay: number
}

interface PrepackDetail {
  id: number
  item_number: string
  po_number: string
  amount: number
  revenue: number
  materialCostTotal: number
  date_packed: string
  date_added: string
}

interface AirtecDetail {
  id: number
  kistnummer: string | null
  item_number: string | null
  quantity: number
  revenue: number
  date_packed: string
  date_received: string | null
}

export default function PrepackAirtecOverviewPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prepackDaily, setPrepackDaily] = useState<PrepackDailyStat[]>([])
  const [prepackTotals, setPrepackTotals] = useState<PrepackTotals | null>(null)
  const [prepackDetails, setPrepackDetails] = useState<PrepackDetail[]>([])
  const [airtecDaily, setAirtecDaily] = useState<AirtecDailyStat[]>([])
  const [airtecTotals, setAirtecTotals] = useState<AirtecTotals | null>(null)
  const [airtecDetails, setAirtecDetails] = useState<AirtecDetail[]>([])

  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [comparePrepackTotals, setComparePrepackTotals] = useState<PrepackTotals | null>(null)
  const [compareAirtecTotals, setCompareAirtecTotals] = useState<AirtecTotals | null>(null)
  const [comparePrepackDaily, setComparePrepackDaily] = useState<PrepackDailyStat[]>([])
  const [compareAirtecDaily, setCompareAirtecDaily] = useState<AirtecDailyStat[]>([])
  const [compareLoading, setCompareLoading] = useState(false)

  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    setDateTo(toDateInput(today))
    setDateFrom(toDateInput(lastWeek))
  }, [])

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatCurrency = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return '-'
    return `€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatLeadTime = (hours: number | null) => {
    if (hours == null) return '-'
    const days = hours / 24
    return `${days.toFixed(1)} dagen`
  }

  const formatNumber = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return '-'
    return Number(value).toLocaleString('nl-NL')
  }

  const pctChange = (current: number, previous: number): number | null => {
    if (!previous || !Number.isFinite(previous)) return null
    return ((current - previous) / previous) * 100
  }

  const formatSignedNumber = (value: number) => {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toLocaleString('nl-NL')}`
  }

  const formatRatio = (incoming: number, packed: number) => {
    if (packed <= 0) return '—'
    return `${(incoming / packed).toFixed(2)}×`
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      const [prepackRes, airtecRes] = await Promise.all([
        fetch(`/api/admin/prepack-stats?${params}`),
        fetch(`/api/admin/airtec-stats?${params}`),
      ])

      if (!prepackRes.ok) throw new Error('Prepack stats laden mislukt')
      if (!airtecRes.ok) throw new Error('Airtec stats laden mislukt')

      const prepackData = await prepackRes.json()
      const airtecData = await airtecRes.json()

      setPrepackDaily(prepackData.dailyStats || [])
      setPrepackTotals(prepackData.totals || null)
      setPrepackDetails(prepackData.detailedItems || [])

      setAirtecDaily(airtecData.dailyStats || [])
      setAirtecTotals(airtecData.totals || null)
      setAirtecDetails(airtecData.detailedItems || [])
    } catch (err) {
      console.error('Error fetching combined stats:', err)
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const fetchCompareStats = useCallback(async (from: string, to: string) => {
    if (!from || !to) return
    setCompareLoading(true)
    try {
      const params = new URLSearchParams({ date_from: from, date_to: to, include_details: 'false' })
      const [prepackRes, airtecRes] = await Promise.all([
        fetch(`/api/admin/prepack-stats?${params}`),
        fetch(`/api/admin/airtec-stats?${params}`),
      ])
      if (!prepackRes.ok || !airtecRes.ok) throw new Error('Vergelijkingsperiode laden mislukt')
      const [prepackData, airtecData] = await Promise.all([prepackRes.json(), airtecRes.json()])
      setComparePrepackTotals(prepackData.totals || null)
      setCompareAirtecTotals(airtecData.totals || null)
      setComparePrepackDaily(prepackData.dailyStats || [])
      setCompareAirtecDaily(airtecData.dailyStats || [])
    } catch (err) {
      console.error('compare combined fetch failed:', err)
      setComparePrepackTotals(null)
      setCompareAirtecTotals(null)
      setComparePrepackDaily([])
      setCompareAirtecDaily([])
    } finally {
      setCompareLoading(false)
    }
  }, [])

  useEffect(() => {
    if (compareEnabled && compareFrom && compareTo) {
      fetchCompareStats(compareFrom, compareTo)
    } else {
      setComparePrepackTotals(null)
      setCompareAirtecTotals(null)
      setComparePrepackDaily([])
      setCompareAirtecDaily([])
    }
  }, [compareEnabled, compareFrom, compareTo, fetchCompareStats])

  const handleApplyComparePreset = useCallback((key: ComparePresetKey) => {
    const range = getComparePreset(key)
    setDateFrom(range.primaryFrom)
    setDateTo(range.primaryTo)
    setCompareEnabled(true)
    setCompareFrom(range.compareFrom)
    setCompareTo(range.compareTo)
  }, [])

  const handleEnableCompare = useCallback(() => {
    setCompareEnabled(true)
    if (!compareFrom || !compareTo) {
      const prev = getPreviousPeriodRange(dateFrom, dateTo)
      if (prev) {
        setCompareFrom(prev.from)
        setCompareTo(prev.to)
      }
    }
  }, [compareFrom, compareTo, dateFrom, dateTo])

  // Gecombineerde totalen (prepack + airtec) voor vergelijking
  const countCombinedActivityDays = (
    ppDaily: PrepackDailyStat[],
    atDaily: AirtecDailyStat[]
  ): number => {
    const dates = new Set<string>()
    for (const row of ppDaily) {
      if (row.itemsPacked > 0 || row.manHours > 0 || row.incomingItems > 0) dates.add(row.date)
    }
    for (const row of atDaily) {
      if (row.itemsPacked > 0 || row.manHours > 0 || row.incomingItems > 0) dates.add(row.date)
    }
    return dates.size
  }

  const buildCombinedTotals = (
    pp: PrepackTotals | null,
    at: AirtecTotals | null,
    ppDaily: PrepackDailyStat[] = [],
    atDaily: AirtecDailyStat[] = []
  ): CompareTotals | null => {
    if (!pp && !at) return null
    const ppI = pp?.totalItemsPacked ?? 0
    const atI = at?.totalItemsPacked ?? 0
    const ppH = pp?.totalManHours ?? 0
    const atH = at?.totalManHours ?? 0
    const totalItems = ppI + atI
    const totalHours = ppH + atH
    const totalRevenue = (pp?.totalRevenue ?? 0) + (at?.totalRevenue ?? 0)
    const totalMaterial = (pp?.totalMaterialCost ?? 0) + (at?.totalMaterialCost ?? 0)
    const totalIncoming = (pp?.totalIncoming ?? 0) + (at?.totalIncoming ?? 0)
    const activityDays = countCombinedActivityDays(ppDaily, atDaily)
    const totalDays =
      activityDays > 0 ? activityDays : Math.max(pp?.totalDays ?? 0, at?.totalDays ?? 0)
    const totalFte = (pp?.totalFte ?? 0) + (at?.totalFte ?? 0)
    const averageItemsPerFte = totalFte > 0 ? totalItems / totalFte : 0
    const weightedLead =
      (pp?.avgLeadTimeHours ?? 0) * ppI + (at?.avgLeadTimeHours ?? 0) * atI
    const avgLeadTimeHours = totalItems > 0 ? weightedLead / totalItems : null
    return {
      totalItemsPacked: totalItems,
      totalManHours: totalHours,
      averageItemsPerFte,
      totalDays,
      totalRevenue,
      totalMaterialCost: totalMaterial,
      totalIncoming,
      incomingVsPackedRatio: totalItems > 0 ? Number((totalIncoming / totalItems).toFixed(2)) : null,
      avgLeadTimeHours,
    }
  }

  const combinedTotals = useMemo(
    () => buildCombinedTotals(prepackTotals, airtecTotals, prepackDaily, airtecDaily),
    [prepackTotals, airtecTotals, prepackDaily, airtecDaily]
  )
  const combinedCompareTotals = useMemo(
    () =>
      buildCombinedTotals(
        comparePrepackTotals,
        compareAirtecTotals,
        comparePrepackDaily,
        compareAirtecDaily
      ),
    [comparePrepackTotals, compareAirtecTotals, comparePrepackDaily, compareAirtecDaily]
  )

  const prepackSummary = useMemo(() => {
    if (!prepackTotals) return null
    return [
      { label: 'Items ingepakt', value: prepackTotals.totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(prepackTotals.totalRevenue) },
      { label: 'Materiaalkost', value: formatCurrency(prepackTotals.totalMaterialCost) },
      { label: 'Manuren', value: prepackTotals.totalManHours.toFixed(1) },
      { label: 'Instroom', value: prepackTotals.totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(prepackTotals.avgLeadTimeHours) },
    ]
  }, [prepackTotals])

  const airtecSummary = useMemo(() => {
    if (!airtecTotals) return null
    return [
      { label: 'Items ingepakt', value: airtecTotals.totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(airtecTotals.totalRevenue) },
      { label: 'Materiaalkost', value: formatCurrency(airtecTotals.totalMaterialCost) },
      { label: 'Manuren', value: airtecTotals.totalManHours.toFixed(1) },
      { label: 'Instroom', value: airtecTotals.totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(airtecTotals.avgLeadTimeHours) },
    ]
  }, [airtecTotals])

  const combinedSummary = useMemo(() => {
    if (!prepackTotals || !airtecTotals) return null
    const totalItemsPacked = prepackTotals.totalItemsPacked + airtecTotals.totalItemsPacked
    const totalRevenue = prepackTotals.totalRevenue + airtecTotals.totalRevenue
    const totalMaterialCost = prepackTotals.totalMaterialCost + airtecTotals.totalMaterialCost
    const totalManHours = prepackTotals.totalManHours + airtecTotals.totalManHours
    const totalIncoming = prepackTotals.totalIncoming + airtecTotals.totalIncoming
    const weightedLeadTimeHours =
      (prepackTotals.avgLeadTimeHours || 0) * prepackTotals.totalItemsPacked +
      (airtecTotals.avgLeadTimeHours || 0) * airtecTotals.totalItemsPacked
    const leadTimeHours =
      totalItemsPacked > 0 ? weightedLeadTimeHours / totalItemsPacked : null

    return [
      { label: 'Items ingepakt', value: totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(totalRevenue) },
      { label: 'Materiaalkost', value: formatCurrency(totalMaterialCost) },
      { label: 'Manuren', value: totalManHours.toFixed(1) },
      { label: 'Instroom', value: totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(leadTimeHours) },
    ]
  }, [prepackTotals, airtecTotals])

  const prepackChartData = useMemo(
    () =>
      prepackDaily.map((row) => ({
        date: formatDate(row.date),
        rawDate: row.date,
        itemsPacked: row.itemsPacked,
        incomingItems: row.incomingItems,
        manHours: row.manHours,
        revenue: row.revenue,
        materialCost: row.materialCost,
      })),
    [prepackDaily]
  )

  const airtecChartData = useMemo(
    () =>
      airtecDaily.map((row) => ({
        date: formatDate(row.date),
        rawDate: row.date,
        itemsPacked: row.itemsPacked,
        incomingItems: row.incomingItems,
        manHours: row.manHours,
        revenue: row.revenue,
        materialCost: row.materialCost,
      })),
    [airtecDaily]
  )

  const incomingCompareRows = useMemo(() => {
    if (!compareEnabled || !prepackTotals || !airtecTotals) return []
    const rows = [
      {
        label: 'Totaal (Prepack + Airtec)',
        current: (prepackTotals.totalIncoming ?? 0) + (airtecTotals.totalIncoming ?? 0),
        compare: (comparePrepackTotals?.totalIncoming ?? 0) + (compareAirtecTotals?.totalIncoming ?? 0),
      },
      {
        label: 'Prepack',
        current: prepackTotals.totalIncoming ?? 0,
        compare: comparePrepackTotals?.totalIncoming ?? 0,
      },
      {
        label: 'Airtec',
        current: airtecTotals.totalIncoming ?? 0,
        compare: compareAirtecTotals?.totalIncoming ?? 0,
      },
    ]
    return rows.map((row) => ({
      ...row,
      diff: row.current - row.compare,
      pct: pctChange(row.current, row.compare),
    }))
  }, [
    compareEnabled,
    prepackTotals,
    airtecTotals,
    comparePrepackTotals,
    compareAirtecTotals,
  ])

  const incomingFlowChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string
        dateLabel: string
        prepackIncoming: number
        airtecIncoming: number
        prepackPacked: number
        airtecPacked: number
      }
    >()

    for (const row of prepackDaily) {
      const iso = row.date
      const existing = map.get(iso) ?? {
        date: iso,
        dateLabel: formatDate(iso),
        prepackIncoming: 0,
        airtecIncoming: 0,
        prepackPacked: 0,
        airtecPacked: 0,
      }
      existing.prepackIncoming += row.incomingItems
      existing.prepackPacked += row.itemsPacked
      map.set(iso, existing)
    }
    for (const row of airtecDaily) {
      const iso = row.date
      const existing = map.get(iso) ?? {
        date: iso,
        dateLabel: formatDate(iso),
        prepackIncoming: 0,
        airtecIncoming: 0,
        prepackPacked: 0,
        airtecPacked: 0,
      }
      existing.airtecIncoming += row.incomingItems
      existing.airtecPacked += row.itemsPacked
      map.set(iso, existing)
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        totalIncoming: row.prepackIncoming + row.airtecIncoming,
        totalPacked: row.prepackPacked + row.airtecPacked,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [prepackDaily, airtecDaily])

  // Gecombineerde grafiek: merge prepack + airtec per datum
  const combinedChartData = useMemo(() => {
    const map = new Map<string, {
      date: string
      dateLabel: string
      prepackItems: number; airtecItems: number
      prepackManHours: number; airtecManHours: number
      prepackRevenue: number; airtecRevenue: number
    }>()

    for (const row of prepackDaily) {
      const iso = row.date
      const existing = map.get(iso) ?? { date: iso, dateLabel: formatDate(iso), prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0, prepackRevenue: 0, airtecRevenue: 0 }
      existing.prepackItems    += row.itemsPacked
      existing.prepackManHours += row.manHours
      existing.prepackRevenue  += row.revenue
      map.set(iso, existing)
    }
    for (const row of airtecDaily) {
      const iso = row.date
      const existing = map.get(iso) ?? { date: iso, dateLabel: formatDate(iso), prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0, prepackRevenue: 0, airtecRevenue: 0 }
      existing.airtecItems    += row.itemsPacked
      existing.airtecManHours += row.manHours
      existing.airtecRevenue  += row.revenue
      map.set(iso, existing)
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [prepackDaily, airtecDaily])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Prepack + Airtec overzicht</h1>
          <p className="text-gray-600 mt-1">Gecombineerde details voor beide teams.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/prepack"
            className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm"
          >
            Prepack detail
          </Link>
          <Link
            href="/admin/airtec"
            className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm"
          >
            Airtec detail
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Van</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tot</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:bg-gray-300"
          >
            {loading ? 'Laden...' : 'Vernieuwen'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      <PeriodCompareCard
        title="Periode-analyse & vergelijking (Prepack + Airtec)"
        subtitle="Vergelijk de gecombineerde output en omzet van beide teams tussen twee periodes."
        accent="emerald"
        dateFrom={dateFrom}
        dateTo={dateTo}
        compareEnabled={compareEnabled}
        compareFrom={compareFrom}
        compareTo={compareTo}
        totals={combinedTotals}
        compareTotals={combinedCompareTotals}
        loading={loading || compareLoading}
        onApplyPreset={handleApplyComparePreset}
        onEnableCompare={handleEnableCompare}
        onDisableCompare={() => setCompareEnabled(false)}
        onChangeCompareRange={(from, to) => {
          setCompareFrom(from)
          setCompareTo(to)
        }}
        formatCurrency={(v: number) => formatCurrency(v) || '-'}
      />

      {compareEnabled && (comparePrepackTotals || compareAirtecTotals) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <PeriodCompareCard
            title="Prepack vergelijking"
            subtitle="Alleen Prepack-cijfers"
            accent="indigo"
            dateFrom={dateFrom}
            dateTo={dateTo}
            compareEnabled={compareEnabled}
            compareFrom={compareFrom}
            compareTo={compareTo}
            totals={prepackTotals as unknown as CompareTotals | null}
            compareTotals={comparePrepackTotals as unknown as CompareTotals | null}
            loading={loading || compareLoading}
            onApplyPreset={handleApplyComparePreset}
            formatCurrency={(v: number) => formatCurrency(v) || '-'}
          />
          <PeriodCompareCard
            title="Airtec vergelijking"
            subtitle="Alleen Airtec-cijfers"
            accent="purple"
            dateFrom={dateFrom}
            dateTo={dateTo}
            compareEnabled={compareEnabled}
            compareFrom={compareFrom}
            compareTo={compareTo}
            totals={airtecTotals as unknown as CompareTotals | null}
            compareTotals={compareAirtecTotals as unknown as CompareTotals | null}
            loading={loading || compareLoading}
            onApplyPreset={handleApplyComparePreset}
            formatCurrency={(v: number) => formatCurrency(v) || '-'}
          />
        </div>
      )}

      {combinedSummary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Gezamenlijke KPI&apos;s</h2>
            <span className="text-xs text-gray-500">Prepack + Airtec</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
            {combinedSummary.map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(prepackTotals || airtecTotals) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Goederen binnen</h2>
              <p className="text-sm text-gray-600 mt-1">
                Aantal items dat in de geselecteerde periode is binnengekomen (Prepack:{' '}
                <span className="font-medium">items_to_pack</span>, Airtec:{' '}
                <span className="font-medium">ontvangstdatum</span>).
              </p>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {dateFrom} → {dateTo}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Totaal instroom</div>
              <div className="text-2xl font-bold text-sky-950 mt-1">
                {formatNumber((prepackTotals?.totalIncoming ?? 0) + (airtecTotals?.totalIncoming ?? 0))}
              </div>
              <div className="text-xs text-sky-800 mt-1">
                Ratio instroom/verpakt:{' '}
                {formatRatio(
                  (prepackTotals?.totalIncoming ?? 0) + (airtecTotals?.totalIncoming ?? 0),
                  (prepackTotals?.totalItemsPacked ?? 0) + (airtecTotals?.totalItemsPacked ?? 0)
                )}
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Prepack</div>
              <div className="text-2xl font-bold text-indigo-950 mt-1">
                {formatNumber(prepackTotals?.totalIncoming)}
              </div>
              <div className="text-xs text-indigo-800 mt-1">
                Verpakt: {formatNumber(prepackTotals?.totalItemsPacked)} · Ratio{' '}
                {prepackTotals
                  ? formatRatio(prepackTotals.totalIncoming, prepackTotals.totalItemsPacked)
                  : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">Airtec</div>
              <div className="text-2xl font-bold text-purple-950 mt-1">
                {formatNumber(airtecTotals?.totalIncoming)}
              </div>
              <div className="text-xs text-purple-800 mt-1">
                Verpakt: {formatNumber(airtecTotals?.totalItemsPacked)} · Ratio{' '}
                {airtecTotals ? formatRatio(airtecTotals.totalIncoming, airtecTotals.totalItemsPacked) : '—'}
              </div>
            </div>
          </div>

          {compareEnabled && incomingCompareRows.length > 0 && (
            <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Flow</th>
                    <th className="px-4 py-3 text-right font-semibold">Periode A</th>
                    <th className="px-4 py-3 text-right font-semibold">Periode B</th>
                    <th className="px-4 py-3 text-right font-semibold">Verschil</th>
                    <th className="px-4 py-3 text-right font-semibold">% wijziging</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {incomingCompareRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.current)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.compare)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatSignedNumber(row.diff)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.pct != null ? `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                Periode A: {dateFrom} → {dateTo} · Periode B: {compareFrom} → {compareTo}
              </p>
            </div>
          )}

          <h3 className="text-sm font-semibold mb-2">Instroom vs verpakt per dag</h3>
          <div className="h-72">
            {incomingFlowChartData.length === 0 ? (
              <p className="text-sm text-gray-500">Geen instroomdata voor deze periode.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={incomingFlowChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalIncoming"
                    name="Goederen binnen (totaal)"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalPacked"
                    name="Items verpakt (totaal)"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Bar dataKey="prepackIncoming" name="Instroom Prepack" fill="#6366f1" opacity={0.35} />
                  <Bar dataKey="airtecIncoming" name="Instroom Airtec" fill="#a855f7" opacity={0.35} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Prepack</h2>
            <span className="text-xs text-gray-500">Totaal & details</span>
          </div>
          {prepackSummary ? (
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {prepackSummary.map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-6">Geen data.</p>
          )}

          <h3 className="text-sm font-semibold mb-2">Dagoverzicht</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Binnen</th>
                  <th className="px-3 py-2 text-left">Verpakt</th>
                  <th className="px-3 py-2 text-left">Omzet</th>
                  <th className="px-3 py-2 text-left">Materiaalkost</th>
                </tr>
              </thead>
              <tbody>
                {prepackDaily.map((row) => (
                  <tr key={row.date} className="border-b">
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.incomingItems}</td>
                    <td className="px-3 py-2 tabular-nums">{row.itemsPacked}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.materialCost)}</td>
                  </tr>
                ))}
                {prepackDaily.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-gray-500 text-center">
                      Geen data voor deze periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold mb-2">KPI grafiek</h3>
          <div className="h-72">
            {prepackChartData.length === 0 ? (
              <p className="text-sm text-gray-500">Geen data voor grafiek.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prepackChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="items" orientation="left"  tick={{ fontSize: 11 }} label={{ value: 'Items / u', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10 } }} />
                  <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} label={{ value: '€', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10 } }} />
                  <Tooltip formatter={(value, name) => name === 'Omzet' || name === 'Materiaalkost' ? [`€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, name] : [value, name]} />
                  <Legend />
                  <Bar  yAxisId="items" dataKey="itemsPacked" name="Verpakt"         fill="#2563eb" opacity={0.85} />
                  <Line yAxisId="items" dataKey="incomingItems" name="Binnen"       stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="items" dataKey="manHours"    name="Manuren"        stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="money" dataKey="revenue"     name="Omzet"          stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="money" dataKey="materialCost" name="Materiaalkost" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Airtec</h2>
            <span className="text-xs text-gray-500">Totaal & details</span>
          </div>
          {airtecSummary ? (
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {airtecSummary.map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-6">Geen data.</p>
          )}

          <h3 className="text-sm font-semibold mb-2">Dagoverzicht</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Binnen</th>
                  <th className="px-3 py-2 text-left">Verpakt</th>
                  <th className="px-3 py-2 text-left">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {airtecDaily.map((row) => (
                  <tr key={row.date} className="border-b">
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.incomingItems}</td>
                    <td className="px-3 py-2 tabular-nums">{row.itemsPacked}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
                {airtecDaily.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-gray-500 text-center">
                      Geen data voor deze periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold mb-2">KPI grafiek</h3>
          <div className="h-72">
            {airtecChartData.length === 0 ? (
              <p className="text-sm text-gray-500">Geen data voor grafiek.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={airtecChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="items" orientation="left"  tick={{ fontSize: 11 }} label={{ value: 'Items / u', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10 } }} />
                  <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} label={{ value: '€', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10 } }} />
                  <Tooltip formatter={(value, name) => name === 'Omzet' || name === 'Materiaalkost' ? [`€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, name] : [value, name]} />
                  <Legend />
                  <Bar  yAxisId="items" dataKey="itemsPacked" name="Verpakt"         fill="#7c3aed" opacity={0.85} />
                  <Line yAxisId="items" dataKey="incomingItems" name="Binnen"       stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="items" dataKey="manHours"    name="Manuren"        stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="money" dataKey="revenue"     name="Omzet"          stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="money" dataKey="materialCost" name="Materiaalkost" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Gecombineerde grafiek: Prepack + Airtec samen */}
      {combinedChartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Gecombineerde grafiek — Prepack &amp; Airtec</h2>
            <span className="text-xs text-gray-500">Items + Manuren per flow</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="items" orientation="left"  tick={{ fontSize: 11 }} label={{ value: 'Items / u', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10 } }} />
                <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} label={{ value: '€', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10 } }} />
                <Tooltip formatter={(value, name) => name === 'Omzet Prepack' || name === 'Omzet Airtec' ? [`€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, name] : [value, name]} />
                <Legend />
                <Bar  yAxisId="items" dataKey="prepackItems"    name="Items Prepack"    fill="#2563eb" opacity={0.8} />
                <Bar  yAxisId="items" dataKey="airtecItems"     name="Items Airtec"     fill="#7c3aed" opacity={0.8} />
                <Line yAxisId="items" dataKey="prepackManHours" name="Manuren Prepack"  stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                <Line yAxisId="items" dataKey="airtecManHours"  name="Manuren Airtec"   stroke="#a855f7" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                <Line yAxisId="money" dataKey="prepackRevenue"  name="Omzet Prepack"    stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="money" dataKey="airtecRevenue"   name="Omzet Airtec"     stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
