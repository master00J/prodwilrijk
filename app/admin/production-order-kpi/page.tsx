'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/components/AuthProvider'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE, SITES, type Site } from '@/lib/sites'
import { RefreshCw, User, Wrench } from 'lucide-react'
import { KpiChartsSection } from './KpiChartsSection'
import { KpiSecondaryStats, KpiSummaryCards } from './KpiSummaryCards'
import { OrderManagementSection } from './OrderManagementSection'
import { ProductionDetailTable } from './ProductionDetailTable'
import { formatElapsed, toIsoDate } from './kpi-formatters'
import type {
  ActiveSession,
  DailyFinancial,
  DailyHours,
  DerivedKpis,
  KpiData,
  ManagedOrder,
  RevenueRun,
  RevenueTotals,
} from './types'

type DatePreset = 'today' | 'week' | 'month' | 'all'
type BottomTab = 'detail' | 'orders'

function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

export default function ProductionOrderKpiPage() {
  const { allowedSites } = useAuth()
  const availableSites = useMemo(
    () => (allowedSites.length > 0 ? SITES.filter((s) => allowedSites.includes(s)) : [...SITES]),
    [allowedSites]
  )

  const [selectedSite, setSelectedSite] = useState<Site>(DEFAULT_SITE)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [runs, setRuns] = useState<RevenueRun[]>([])
  const [totals, setTotals] = useState<RevenueTotals | null>(null)
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [bottomTab, setBottomTab] = useState<BottomTab>('detail')

  const [manageSite, setManageSite] = useState<Site>(DEFAULT_SITE)
  const [manageTab, setManageTab] = useState<'actief' | 'afgewerkt'>('actief')
  const [manageSearch, setManageSearch] = useState('')
  const [managedOrders, setManagedOrders] = useState<ManagedOrder[]>([])
  const [manageLoading, setManageLoading] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(selectedSite)) {
      setSelectedSite(availableSites[0])
    }
  }, [availableSites, selectedSite])

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(manageSite)) {
      setManageSite(availableSites[0])
    }
  }, [availableSites, manageSite])

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ site: selectedSite })
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return params
  }, [selectedSite, dateFrom, dateTo])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams()
      const [revenueRes, kpiRes] = await Promise.all([
        fetch(`/api/production-order-time/revenue?${params.toString()}`),
        fetch(`/api/production-order-time/kpi?${params.toString()}`),
      ])
      if (!revenueRes.ok) throw new Error('Opbrengsten ophalen mislukt')
      if (!kpiRes.ok) throw new Error('KPI-data ophalen mislukt')
      const revenueData = await revenueRes.json()
      const kpiJson = await kpiRes.json()
      setRuns(revenueData.runs || [])
      setTotals(revenueData.totals || null)
      setKpiData({
        orders: kpiJson.orders || [],
        steps: kpiJson.steps || [],
        employees: kpiJson.employees || [],
        items: kpiJson.items || [],
        zaagByDate: kpiJson.zaagByDate || [],
        dailyStepHours: kpiJson.dailyStepHours || [],
      })
    } catch (e) {
      console.error(e)
      alert('Data laden mislukt')
      setRuns([])
      setTotals(null)
      setKpiData(null)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const loadActive = useCallback(async () => {
    try {
      const params = new URLSearchParams({ site: selectedSite })
      const res = await fetch(`/api/production-order-time/active?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      setActiveSessions(Array.isArray(data) ? data : [])
    } catch {
      setActiveSessions([])
    }
  }, [selectedSite])

  const loadManagedOrders = useCallback(async () => {
    setManageLoading(true)
    try {
      const params = new URLSearchParams({
        site: manageSite,
        finished: manageTab === 'afgewerkt' ? 'true' : 'false',
      })
      if (manageSearch.trim()) params.set('q', manageSearch.trim())
      const res = await fetch(`/api/production-orders/list?${params.toString()}`)
      if (!res.ok) throw new Error('Orders ophalen mislukt')
      const data = await res.json()
      setManagedOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch (e) {
      console.error(e)
      setManagedOrders([])
    } finally {
      setManageLoading(false)
    }
  }, [manageSite, manageTab, manageSearch])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadActive()
    const t = setInterval(loadActive, 15000)
    return () => clearInterval(t)
  }, [loadActive])

  useEffect(() => {
    void loadManagedOrders()
  }, [loadManagedOrders])

  const applyPreset = (preset: DatePreset) => {
    const today = new Date()
    if (preset === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }
    if (preset === 'today') {
      const d = toIsoDate(today)
      setDateFrom(d)
      setDateTo(d)
      return
    }
    if (preset === 'week') {
      setDateFrom(toIsoDate(startOfWeek(today)))
      setDateTo(toIsoDate(today))
      return
    }
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    setDateFrom(toIsoDate(monthStart))
    setDateTo(toIsoDate(today))
  }

  const derived = useMemo<DerivedKpis>(() => {
    const totalQuantity = runs.reduce((s, r) => s + (r.quantity || 0), 0)
    const runCount = runs.length
    const uniqueOrders = new Set(runs.map((r) => r.order_number).filter(Boolean)).size
    const uniqueItems = new Set(runs.map((r) => r.item_number).filter(Boolean)).size
    const uniqueEmployees = kpiData?.employees?.length ?? 0
    const totalHours = totals?.total_hours ?? 0
    const totalRevenue = totals?.total_revenue ?? 0
    const totalMaterial = totals?.total_material_cost ?? 0
    const totalMargin = totals?.total_margin ?? 0
    const zaagHours = (kpiData?.zaagByDate ?? []).reduce((s, z) => s + z.hours, 0)

    return {
      totalQuantity,
      runCount,
      uniqueOrders,
      uniqueItems,
      uniqueEmployees,
      avgHoursPerPiece: totalQuantity > 0 ? totalHours / totalQuantity : 0,
      marginPct: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : null,
      materialPct: totalRevenue > 0 ? (totalMaterial / totalRevenue) * 100 : null,
      revenuePerHour: totalHours > 0 ? totalRevenue / totalHours : null,
      marginPerHour: totalHours > 0 ? totalMargin / totalHours : null,
      avgRevenuePerRun: runCount > 0 ? totalRevenue / runCount : null,
      zaagHours,
      activeStepCount: kpiData?.steps?.length ?? 0,
    }
  }, [runs, totals, kpiData])

  const dailyHours = useMemo<DailyHours[]>(() => {
    const map = new Map<string, number>()
    ;(kpiData?.dailyStepHours ?? []).forEach(({ date, hours }) => {
      map.set(date, (map.get(date) || 0) + hours)
    })
    return Array.from(map.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [kpiData])

  const dailyFinancial = useMemo<DailyFinancial[]>(() => {
    const map = new Map<string, DailyFinancial>()
    runs.forEach((r) => {
      if (!r.date) return
      const existing = map.get(r.date) ?? { date: r.date, revenue: 0, margin: 0, hours: 0, material: 0 }
      existing.revenue += r.revenue ?? 0
      existing.margin += r.margin ?? 0
      existing.hours += r.hours ?? 0
      existing.material += r.material_cost_total ?? 0
      map.set(r.date, existing)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [runs])

  const deleteManagedOrder = async (order: ManagedOrder) => {
    if (
      !confirm(
        `Productieorder "${order.order_number}" verwijderen?\n\nDit verwijdert ook alle gekoppelde tijdregistraties voor deze order.`
      )
    ) {
      return
    }
    setDeletingOrderId(order.id)
    try {
      const res = await fetch(`/api/production-orders/${order.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Verwijderen mislukt')
      await Promise.all([loadManagedOrders(), loadData(), loadActive()])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Verwijderen mislukt')
    } finally {
      setDeletingOrderId(null)
    }
  }

  return (
    <AdminGuard>
      <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-100">
        {/* Sticky filter bar */}
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="px-4 lg:px-6 py-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Productie KPI Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Opbrengsten, kosten, uren en productiviteit — {selectedSite}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value as Site)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  {availableSites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  title="Vanaf"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  title="Tot"
                />
                <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                  {([
                    ['today', 'Vandaag'],
                    ['week', 'Week'],
                    ['month', 'Maand'],
                    ['all', 'Alles'],
                  ] as const).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-200 last:border-r-0"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Laden...' : 'Vernieuwen'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-6 py-5 space-y-5">
          {/* Active sessions */}
          {activeSessions.length > 0 && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-blue-900">
                  Momenteel in productie ({activeSessions.length})
                </h2>
                <span className="text-xs text-blue-600 ml-auto">ververst elke 15 sec</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{s.order_number}</span>
                    <span className="text-gray-600">
                      {s.item_number ? <BcItemCode value={s.item_number} /> : '–'}
                    </span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <User className="h-3.5 w-3.5" />
                      {s.employee_name}
                    </span>
                    <span className="text-blue-700">{s.step || '–'}</span>
                    <span className="text-gray-500 ml-auto">{formatElapsed(s.elapsed_seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <KpiSummaryCards totals={totals} derived={derived} />
          <KpiSecondaryStats derived={derived} />
          <KpiChartsSection kpiData={kpiData} dailyHours={dailyHours} dailyFinancial={dailyFinancial} />

          {/* Bottom tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {([
              ['detail', 'Productiedetail'],
              ['orders', 'Orders beheren'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setBottomTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  bottomTab === tab
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {bottomTab === 'detail' ? (
            <ProductionDetailTable
              runs={runs}
              loading={loading}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          ) : (
            <OrderManagementSection
              availableSites={availableSites}
              manageSite={manageSite}
              setManageSite={setManageSite}
              manageTab={manageTab}
              setManageTab={setManageTab}
              manageSearch={manageSearch}
              setManageSearch={setManageSearch}
              managedOrders={managedOrders}
              manageLoading={manageLoading}
              deletingOrderId={deletingOrderId}
              onRefresh={loadManagedOrders}
              onDelete={deleteManagedOrder}
            />
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
