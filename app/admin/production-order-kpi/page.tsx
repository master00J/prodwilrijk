'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/components/AuthProvider'
import { BcItemCode, useBcMapping } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE, SITES, type Site } from '@/lib/sites'
import { RefreshCw, X } from 'lucide-react'
import { ActiveProductionSection } from './ActiveProductionSection'
import { groupActiveByOrder } from './active-production'
import { KpiChartsSection } from './KpiChartsSection'
import { KpiSecondaryStats, KpiSummaryCards } from './KpiSummaryCards'
import { ItemCompareSection } from './ItemCompareSection'
import { OrderManagementSection } from './OrderManagementSection'
import { ProductionDetailTable } from './ProductionDetailTable'
import { filterRunsByItem, itemMatchesQuery } from './item-analysis'
import { daysAgoIso, toIsoDate, todayIso, yearStartIso } from './kpi-formatters'
import type {
  ActiveSession,
  DailyHours,
  DerivedKpis,
  KpiData,
  ManagedOrder,
  RevenueRun,
} from './types'

type DatePreset = 'today' | 'week' | 'month' | 'all'
type BottomTab = 'live' | 'detail' | 'orders'

function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

export default function ProductionOrderKpiPage() {
  const { allowedSites } = useAuth()
  const { toNew, toOld } = useBcMapping()
  const availableSites = useMemo(
    () => (allowedSites.length > 0 ? SITES.filter((s) => allowedSites.includes(s)) : [...SITES]),
    [allowedSites]
  )

  const [selectedSite, setSelectedSite] = useState<Site>(DEFAULT_SITE)
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30))
  const [dateTo, setDateTo] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [runs, setRuns] = useState<RevenueRun[]>([])
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [activeLoading, setActiveLoading] = useState(false)
  const [bottomTab, setBottomTab] = useState<BottomTab>('live')
  const [selectedItem, setSelectedItem] = useState('')
  const itemCompareRef = useRef<HTMLDivElement>(null)

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
      if (!revenueRes.ok) throw new Error('Productiedata ophalen mislukt')
      if (!kpiRes.ok) throw new Error('KPI-data ophalen mislukt')
      const revenueData = await revenueRes.json()
      const kpiJson = await kpiRes.json()
      setRuns(revenueData.runs || [])
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
      setKpiData(null)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const loadActive = useCallback(async () => {
    setActiveLoading(true)
    try {
      const sitesToLoad = availableSites.length > 0 ? availableSites : [selectedSite]
      const results = await Promise.all(
        sitesToLoad.map(async (site) => {
          const res = await fetch(`/api/production-order-time/active?site=${encodeURIComponent(site)}`)
          if (!res.ok) return []
          const data = await res.json()
          return (Array.isArray(data) ? data : []).map((s: ActiveSession) => ({ ...s, site }))
        })
      )
      setActiveSessions(results.flat())
    } catch {
      setActiveSessions([])
    } finally {
      setActiveLoading(false)
    }
  }, [availableSites, selectedSite])

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

  const scrollToItemCompare = useCallback(() => {
    itemCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (!selectedItem.trim()) return
    const t = window.setTimeout(scrollToItemCompare, 150)
    return () => window.clearTimeout(t)
  }, [selectedItem, scrollToItemCompare])

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

  const filteredRuns = useMemo(() => {
    if (!selectedItem.trim()) return runs
    const exact = filterRunsByItem(runs, selectedItem, toNew, toOld)
    if (exact.length > 0) return exact
    return runs.filter((r) => itemMatchesQuery(r.item_number, selectedItem, toNew, toOld))
  }, [runs, selectedItem, toNew, toOld])

  const derived = useMemo<DerivedKpis>(() => {
    const totalQuantity = filteredRuns.reduce((s, r) => s + (r.quantity || 0), 0)
    const runCount = filteredRuns.length
    const uniqueOrders = new Set(filteredRuns.map((r) => r.order_number).filter(Boolean)).size
    const uniqueItems = new Set(filteredRuns.map((r) => r.item_number).filter(Boolean)).size
    const uniqueEmployees = kpiData?.employees?.length ?? 0
    const totalHours = filteredRuns.reduce((s, r) => s + (r.hours || 0), 0)
    const zaagHours = (kpiData?.zaagByDate ?? []).reduce((s, z) => s + z.hours, 0)
    const totalRevenue = filteredRuns.reduce((s, r) => s + (r.revenue ?? 0), 0)
    const totalMaterialCost = filteredRuns.reduce((s, r) => s + (r.material_cost_total ?? 0), 0)
    const totalMargin = filteredRuns.reduce((s, r) => s + (r.margin ?? 0), 0)
    const marginPctOverall =
      totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : null
    const revPerHourOverall = totalHours > 0 ? totalRevenue / totalHours : null

    return {
      totalQuantity,
      totalHours,
      runCount,
      uniqueOrders,
      uniqueItems,
      uniqueEmployees,
      avgHoursPerPiece: totalQuantity > 0 ? totalHours / totalQuantity : 0,
      zaagHours,
      activeStepCount: kpiData?.steps?.length ?? 0,
      totalRevenue,
      totalMaterialCost,
      totalMargin,
      marginPctOverall,
      revPerHourOverall,
    }
  }, [filteredRuns, kpiData])

  const dailyHours = useMemo<DailyHours[]>(() => {
    const map = new Map<string, number>()
    ;(kpiData?.dailyStepHours ?? []).forEach(({ date, hours }) => {
      map.set(date, (map.get(date) || 0) + hours)
    })
    return Array.from(map.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [kpiData])

  const activeOrderGroups = useMemo(() => groupActiveByOrder(activeSessions), [activeSessions])
  const siteFilteredActiveSessions = useMemo(() => {
    if (availableSites.length <= 1) return activeSessions
    return activeSessions.filter((s) => !s.site || s.site === selectedSite)
  }, [activeSessions, selectedSite, availableSites.length])

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
                <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                  Productie KPI Dashboard
                  {activeOrderGroups.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setBottomTab('live')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                      </span>
                      {activeOrderGroups.length} live
                    </button>
                  ) : null}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Uren, productiviteit en live productie — {selectedSite}
                  {selectedItem ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 text-xs font-medium">
                      Item: <BcItemCode value={selectedItem} />
                      <button
                        type="button"
                        onClick={() => setSelectedItem('')}
                        className="rounded hover:bg-violet-200 p-0.5"
                        title="Itemfilter wissen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
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
                  type="text"
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const q = selectedItem.trim()
                    if (q) {
                      const exact = runs.find(
                        (r) =>
                          r.item_number.trim().toLowerCase() === q.toLowerCase() ||
                          toNew(r.item_number).toLowerCase() === q.toLowerCase()
                      )
                      if (!exact) {
                        const match = [...new Set(runs.map((r) => r.item_number).filter(Boolean))].find(
                          (item) => itemMatchesQuery(item, q, toNew, toOld)
                        )
                        if (match) setSelectedItem(match)
                      }
                    }
                    scrollToItemCompare()
                  }}
                  placeholder="Item vergelijken..."
                  className="rounded-lg border border-violet-200 px-3 py-2 text-sm bg-violet-50/50 w-40 lg:w-48 focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                  list="kpi-header-items"
                  title="Typ een itemnummer en druk Enter om order-vergelijking te openen"
                />
                <datalist id="kpi-header-items">
                  {[...new Set(runs.map((r) => r.item_number).filter(Boolean))].map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
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
                <div className="flex flex-wrap rounded-lg border border-gray-300 overflow-hidden bg-white">
                  {([
                    ['today', 'Vandaag'],
                    ['7d', '7 d'],
                    ['30d', '30 d'],
                    ['90d', '90 d'],
                    ['ytd', 'YTD'],
                    ['week', 'Week'],
                    ['month', 'Maand'],
                    ['all', 'Alles'],
                  ] as const).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (preset === '7d') {
                          setDateFrom(daysAgoIso(7))
                          setDateTo(todayIso())
                          return
                        }
                        if (preset === '30d') {
                          setDateFrom(daysAgoIso(30))
                          setDateTo(todayIso())
                          return
                        }
                        if (preset === '90d') {
                          setDateFrom(daysAgoIso(90))
                          setDateTo(todayIso())
                          return
                        }
                        if (preset === 'ytd') {
                          setDateFrom(yearStartIso())
                          setDateTo(todayIso())
                          return
                        }
                        applyPreset(preset)
                      }}
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
          <ActiveProductionSection
            sessions={siteFilteredActiveSessions}
            loading={activeLoading}
            compact
            showAllSites={availableSites.length > 1}
          />

          <KpiSummaryCards derived={derived} />
          <KpiSecondaryStats derived={derived} />
          <KpiChartsSection kpiData={kpiData} dailyHours={dailyHours} />

          <div ref={itemCompareRef}>
            <ItemCompareSection
              runs={runs}
              loading={loading}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
              id="item-compare"
            />
          </div>

          {/* Bottom tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {([
              ['live', 'Live productie'],
              ['detail', 'Productiedetail'],
              ['orders', 'Orders beheren'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setBottomTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                  bottomTab === tab
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                {tab === 'live' && activeOrderGroups.length > 0 ? (
                  <span className="rounded-full bg-blue-600 text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                    {activeOrderGroups.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {bottomTab === 'live' ? (
            <ActiveProductionSection
              sessions={activeSessions}
              loading={activeLoading}
              showAllSites={availableSites.length > 1}
            />
          ) : bottomTab === 'detail' ? (
            <ProductionDetailTable
              runs={filteredRuns}
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
