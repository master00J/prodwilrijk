'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE, employeeHasSite, SITES, type Site } from '@/lib/sites'
import { useAuth } from '@/components/AuthProvider'
import {
  normalizeScannedOrderNumber,
  OrderBarcodeScanner,
} from '@/components/production-order-time/OrderBarcodeScanner'

interface Employee {
  id: number
  name: string
  sites?: string[] | null
}

interface OrderLine {
  id: number
  line_no: number | null
  item_number: string | null
  description: string | null
  quantity: number
}

interface OrderRow {
  order_number: string
  sales_order_number: string | null
  uploaded_at: string
  finished_at: string | null
  site?: string | null
}

interface ActiveLog {
  id: number
  employee_id: number
  employee_name: string
  start_time: string
  elapsed_seconds: number
  order_number: string
  item_number: string
  step: string
  quantity: number | null
  site?: string | null
}

const STEPS = ['Zagen', 'Hout Halen', 'Assemblage', 'Schuren', 'Afwerking']

type ActiveTaskGroup = {
  key: string
  order_number: string
  item_number: string
  step: string
  elapsed_seconds: number
  logs: ActiveLog[]
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}u ${m}m`
  return `${m}m`
}

export default function ProductionOrderTimePage() {
  const { allowedSites } = useAuth()
  const availableSites = useMemo(
    () => allowedSites.length > 0 ? SITES.filter(siteOption => allowedSites.includes(siteOption)) : [...SITES],
    [allowedSites]
  )
  const [site, setSite] = useState<Site>(DEFAULT_SITE)
  const [activeTab, setActiveTab] = useState<'actief' | 'afgewerkt'>('actief')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'order'>('recent')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [activeLogs, setActiveLogs] = useState<ActiveLog[]>([])
  const [woodAdviceSummary, setWoodAdviceSummary] = useState<{ groups: number; shortage_groups: number; total_shortage: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [modalOrder, setModalOrder] = useState<OrderRow | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedStep, setSelectedStep] = useState(STEPS[0])
  const [customStep, setCustomStep] = useState('')
  const [starting, setStarting] = useState(false)

  const [stopModal, setStopModal] = useState<{
    logId: number
    employeeName?: string
    orderNumber: string
    itemNumber: string
    lineQuantity: number
  } | null>(null)
  const [stopQuantity, setStopQuantity] = useState(1)
  const [stopping, setStopping] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [openingOrder, setOpeningOrder] = useState(false)

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(site)) {
      setSite(availableSites[0])
    }
  }, [availableSites, site])

  const fetchEmployees = useCallback(async () => {
    const response = await fetch('/api/employees')
    if (!response.ok) return
    const data = await response.json()
    setEmployees((data || []).filter((employee: Employee) => employeeHasSite(employee, site)))
  }, [site])

  const fetchActiveLogs = useCallback(async () => {
    const response = await fetch(`/api/production-order-time/active?site=${encodeURIComponent(site)}`)
    if (!response.ok) return
    const data = await response.json()
    setActiveLogs(data || [])
  }, [site])

  const fetchOrders = useCallback(async (finished: boolean, q: string) => {
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('site', site)
      if (finished) params.set('finished', 'true')
      if (q) params.set('q', q)
      const response = await fetch(`/api/production-orders/list?${params.toString()}`)
      if (!response.ok) return
      const data = await response.json()
      setOrders(data.orders || [])
    } finally {
      setOrdersLoading(false)
    }
  }, [site])

  const fetchOrderLines = useCallback(async (orderNumber: string) => {
    if (!orderNumber) {
      setOrderLines([])
      return
    }
    const params = new URLSearchParams({ site })
    const response = await fetch(`/api/production-orders/${encodeURIComponent(orderNumber)}/lines?${params.toString()}`)
    if (!response.ok) {
      setOrderLines([])
      return
    }
    const data = await response.json()
    setOrderLines(
      (data.lines || []).map((l: any) => ({
        ...l,
        quantity: Number(l.quantity) || 1,
      }))
    )
  }, [site])

  const fetchWoodAdviceSummary = useCallback(async () => {
    const response = await fetch(`/api/production-order-time/wood-advice?site=${encodeURIComponent(site)}`)
    if (!response.ok) return
    const data = await response.json()
    setWoodAdviceSummary(data.summary || null)
  }, [site])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchActiveLogs(), fetchOrders(false, ''), fetchWoodAdviceSummary()])
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [fetchEmployees, fetchActiveLogs, fetchOrders, fetchWoodAdviceSummary])

  useEffect(() => {
    const timer = setInterval(() => void fetchActiveLogs(), 30000)
    return () => clearInterval(timer)
  }, [fetchActiveLogs])

  useEffect(() => {
    void fetchOrders(activeTab === 'afgewerkt', searchQuery)
  }, [activeTab, searchQuery, fetchOrders])

  const openOrderModal = async (order: OrderRow) => {
    setModalOrder(order)
    setSelectedEmployeeIds([])
    setSelectedItems([])
    setSelectedStep(STEPS[0])
    setCustomStep('')
    await fetchOrderLines(order.order_number)
  }

  const findOrderByNumber = useCallback(
    async (rawOrderNumber: string, includeFinished = false): Promise<OrderRow | null> => {
      const orderNumber = normalizeScannedOrderNumber(rawOrderNumber)
      if (!orderNumber) return null

      const localMatch = orders.find((order) => order.order_number === orderNumber)
      if (localMatch) return localMatch

      const fetchMatch = async (finished: boolean) => {
        const params = new URLSearchParams({ site, q: orderNumber })
        if (finished) params.set('finished', 'true')
        const response = await fetch(`/api/production-orders/list?${params.toString()}`)
        if (!response.ok) return null
        const data = await response.json()
        return (
          (data.orders as OrderRow[] | undefined)?.find((order) => order.order_number === orderNumber) ?? null
        )
      }

      const activeMatch = await fetchMatch(false)
      if (activeMatch) return activeMatch
      if (includeFinished) return fetchMatch(true)
      return null
    },
    [orders, site]
  )

  const openOrderByNumber = useCallback(
    async (rawOrderNumber: string) => {
      const orderNumber = normalizeScannedOrderNumber(rawOrderNumber)
      if (!orderNumber) return

      setOpeningOrder(true)
      try {
        let order = await findOrderByNumber(orderNumber, false)
        if (!order) {
          order = await findOrderByNumber(orderNumber, true)
          if (order) {
            alert(`Order ${orderNumber} is al afgewerkt en kan niet meer geopend worden voor registratie.`)
            return
          }
          alert(`Geen actieve productieorder gevonden met nummer: ${orderNumber}`)
          return
        }

        if (activeTab !== 'actief') {
          setActiveTab('actief')
          setSearchQuery('')
        }
        await openOrderModal(order)
      } finally {
        setOpeningOrder(false)
      }
    },
    [activeTab, findOrderByNumber, openOrderModal]
  )

  const closeOrderModal = () => {
    setModalOrder(null)
  }

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const toggleItem = (itemNumber: string) => {
    const item = String(itemNumber || '').trim()
    if (!item) return
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item]
    )
  }

  const startRegistration = async (stepOverride?: string) => {
    const step = stepOverride || (selectedStep === 'Andere' ? customStep.trim() : selectedStep)
    if (!step) {
      alert('Selecteer een stap')
      return
    }
    if (selectedEmployeeIds.length === 0) {
      alert('Selecteer minstens één medewerker')
      return
    }
    if (!modalOrder || selectedItems.length === 0) {
      alert('Selecteer minstens één lijn')
      return
    }

    setStarting(true)
    try {
      const response = await fetch('/api/production-order-time/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployeeIds,
          orderNumber: modalOrder.order_number,
          itemNumbers: selectedItems,
          step,
          site,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Starten mislukt')
      }
      await fetchActiveLogs()
      setSelectedEmployeeIds([])
      setSelectedItems([])
      alert(`Tijdregistratie gestart voor ${selectedItems.length} lijn(en)`)
    } catch (e: any) {
      alert(e.message || 'Starten mislukt')
    } finally {
      setStarting(false)
    }
  }

  const openStopModal = async (log: ActiveLog) => {
    const params = new URLSearchParams({ site })
    const res = await fetch(`/api/production-orders/${encodeURIComponent(log.order_number)}/lines?${params.toString()}`)
    if (!res.ok) {
      if (confirm(`Stop tijdregistratie${log.employee_name ? ` voor ${log.employee_name}` : ''}?`)) {
        await doStop(log.id, null)
      }
      return
    }
    const data = await res.json()
    const lines = data.lines || []
    const line = lines.find((l: any) => (l.item_number || '').trim() === (log.item_number || '').trim())
    const qty = Math.max(1, Number(line?.quantity) || 1)
    setStopModal({
      logId: log.id,
      employeeName: log.employee_name,
      orderNumber: log.order_number,
      itemNumber: log.item_number,
      lineQuantity: qty,
    })
    setStopQuantity(Math.min(1, qty))
  }

  const doStop = async (logId: number, quantity: number | null) => {
    setStopping(true)
    try {
      const res = await fetch(`/api/production-order-time/${logId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quantity != null ? { quantity } : {}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Stoppen mislukt')
      }
      setStopModal(null)
      await fetchActiveLogs()
    } catch (e: any) {
      alert(e.message || 'Stoppen mislukt')
    } finally {
      setStopping(false)
    }
  }

  const sortedOrders = useMemo(() => {
    const copy = [...orders]
    if (sortBy === 'order') {
      copy.sort((a, b) => (a.order_number || '').localeCompare(b.order_number || ''))
    } else {
      copy.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''))
    }
    return copy
  }, [orders, sortBy])

  const activeLogsForOrder = useMemo(() => {
    if (!modalOrder) return []
    return activeLogs.filter((log) => log.order_number === modalOrder.order_number)
  }, [activeLogs, modalOrder])

  const groupActiveLogsByTask = useCallback((logs: ActiveLog[]): ActiveTaskGroup[] => {
    const groups = new Map<string, ActiveTaskGroup>()
    logs.forEach((log) => {
      const key = [log.order_number, log.item_number, log.step].join('|')
      const existing = groups.get(key)
      if (existing) {
        existing.logs.push(log)
        existing.elapsed_seconds = Math.max(existing.elapsed_seconds, log.elapsed_seconds)
      } else {
        groups.set(key, {
          key,
          order_number: log.order_number,
          item_number: log.item_number,
          step: log.step,
          elapsed_seconds: log.elapsed_seconds,
          logs: [log],
        })
      }
    })
    return [...groups.values()].sort((a, b) =>
      a.order_number.localeCompare(b.order_number) ||
      a.item_number.localeCompare(b.item_number) ||
      a.step.localeCompare(b.step)
    )
  }, [])

  const activeTaskGroups = useMemo(() => groupActiveLogsByTask(activeLogs), [activeLogs, groupActiveLogsByTask])
  const activeTaskGroupsForOrder = useMemo(
    () => groupActiveLogsByTask(activeLogsForOrder),
    [activeLogsForOrder, groupActiveLogsByTask]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Laden...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Werkregistratie</h1>
        <p className="mt-1 text-sm text-gray-500">
          Werknemers kunnen meerdere orders of lijnen tegelijk actief hebben.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 sm:mb-6 border-b overflow-x-auto">
        <nav className="flex -mb-px min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('actief')}
            className={`min-h-[52px] px-5 sm:px-6 py-3 text-base sm:text-lg font-medium border-b-2 transition-colors ${
              activeTab === 'actief'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Actieve Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('afgewerkt')}
            className={`min-h-[52px] px-5 sm:px-6 py-3 text-base sm:text-lg font-medium border-b-2 transition-colors ${
              activeTab === 'afgewerkt'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Afgewerkte Orders
          </button>
        </nav>
      </div>

      <div className="mb-5 sm:mb-6">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          disabled={openingOrder}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[52px] bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 disabled:opacity-60 text-lg font-medium"
        >
          <ScanBarcode className="h-5 w-5" />
          {openingOrder ? 'Order zoeken...' : 'Scan werkbon'}
        </button>
        <p className="mt-2 text-sm text-gray-500">
          Scan de barcode op de werkbon om de productieorder automatisch te openen.
        </p>
      </div>

      {/* Zoek en filters */}
      <div className="mb-5 sm:mb-6 flex flex-col lg:flex-row gap-3 sm:gap-4 items-center">
        <div className="w-full lg:w-1/3">
          <select
            value={site}
            onChange={(e) => {
              setSite(e.target.value as Site)
              setSelectedEmployeeIds([])
              setModalOrder(null)
            }}
            className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg shadow-sm"
          >
            {availableSites.map(siteOption => (
              <option key={siteOption} value={siteOption}>{siteOption}</option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-1/3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek orders..."
            className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg shadow-sm"
          />
        </div>
        <div className="w-full lg:w-1/3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'order')}
            className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg shadow-sm"
          >
            <option value="recent">Meest recent</option>
            <option value="order">Ordernummer (A-Z)</option>
          </select>
        </div>
      </div>

      {activeTab === 'actief' && woodAdviceSummary && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Houtadvies voor open productieorders</div>
          <div className="mt-1">
            {woodAdviceSummary.shortage_groups > 0 ? (
              <>
                {woodAdviceSummary.shortage_groups} houtgroep(en) met tekort voor {site}, totaal {woodAdviceSummary.total_shortage} plank(en).
                Bekijk details bij <span className="font-medium">Admin &gt; Productieorder upload</span>.
              </>
            ) : (
              <>
                Alle {woodAdviceSummary.groups} houtgroep(en) voor {site} lijken gedekt door de huidige voorraad.
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'actief' && (
        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 sm:p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nu actief</h2>
              <p className="text-sm text-slate-600">
                {activeLogs.length === 0
                  ? 'Geen lopende tijdregistraties.'
                  : `${activeLogs.length} lopende registratie(s), gegroepeerd in ${activeTaskGroups.length} taak/taken.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchActiveLogs()}
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50 sm:mt-0"
            >
              Vernieuwen
            </button>
          </div>

          {activeLogs.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {activeTaskGroups.map((group) => (
                <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{group.order_number}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                        <span className="rounded bg-slate-100 px-2 py-0.5">
                          <BcItemCode value={group.item_number} />
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5">{group.step}</span>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                          {formatElapsed(group.elapsed_seconds)}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {group.logs.length} medewerker(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900">{log.employee_name}</div>
                            <div className="text-sm text-slate-500">Gestart: {new Date(log.start_time).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openStopModal(log)}
                            className="min-h-[48px] rounded-lg bg-red-500 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-600 sm:min-w-[96px]"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Orders tabel (desktop) */}
      <section className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ordernummer</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden lg:table-cell">
                Verkooporder
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                {activeTab === 'actief' ? 'Geüpload' : 'Afgewerkt'}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acties</th>
            </tr>
          </thead>
          <tbody>
            {ordersLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Laden...
                </td>
              </tr>
            ) : sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Geen orders gevonden.
                </td>
              </tr>
            ) : (
              sortedOrders.map((order) => (
                <tr
                  key={`${order.site || site}-${order.order_number}`}
                  className="border-t border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{order.order_number}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 hidden lg:table-cell">
                    {order.sales_order_number || '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {formatDate(activeTab === 'actief' ? order.uploaded_at : order.finished_at)}
                  </td>
                  <td className="px-6 py-3">
                    {activeTab === 'actief' && (
                      <button
                        type="button"
                        onClick={() => openOrderModal(order)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[40px]"
                      >
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Orders cards (mobiel) */}
      <div className="md:hidden space-y-4 mt-4">
        {ordersLoading ? (
          <div className="text-center py-8 text-gray-500">Laden...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Geen orders gevonden.</div>
        ) : (
          sortedOrders.map((order) => (
            <div
              key={`${order.site || site}-${order.order_number}`}
              className="bg-white rounded-lg shadow p-4 border border-gray-200"
            >
              <div className="font-medium text-gray-900">{order.order_number}</div>
              <div className="text-sm text-gray-600 mt-1">
                {formatDate(activeTab === 'actief' ? order.uploaded_at : order.finished_at)}
              </div>
              {activeTab === 'actief' && (
                <button
                  type="button"
                  onClick={() => openOrderModal(order)}
                  className="mt-3 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[48px]"
                >
                  Open
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      {modalOrder && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-lg">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-4 sm:p-6">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">Order {modalOrder.order_number}</h2>
                {modalOrder.sales_order_number && (
                  <p className="mt-1 text-sm text-gray-500">Verkooporder {modalOrder.sales_order_number}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeOrderModal}
                className="min-h-[44px] min-w-[44px] rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Sluit modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32 sm:p-6 sm:pb-6">
              {/* Order info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Order:</span> {modalOrder.order_number}
                  {modalOrder.sales_order_number && (
                    <>
                      {' · '}
                      <span className="font-medium">Verkoop:</span> {modalOrder.sales_order_number}
                    </>
                  )}
                </div>
              </div>

              {/* Actieve tijdsregistraties */}
              {activeTaskGroupsForOrder.length > 0 && (
                <section className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold">Actieve registraties op deze order</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {activeTaskGroupsForOrder.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-xl border border-slate-200 bg-gray-50 p-3"
                      >
                        <div className="mb-3 text-sm">
                          <div className="font-semibold text-slate-900">
                            <BcItemCode value={group.item_number} /> · {group.step}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-slate-600">
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                              {formatElapsed(group.elapsed_seconds)}
                            </span>
                            <span className="rounded bg-white px-2 py-0.5">{group.logs.length} medewerker(s)</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.logs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                              <span className="text-sm font-medium text-slate-800">{log.employee_name}</span>
                              <button
                                type="button"
                                onClick={() => openStopModal(log)}
                                className="min-h-[40px] rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                              >
                                Stop
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Items tabel */}
              <section className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Items</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Hoeveelheid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderLines.map((line) => (
                        <tr key={line.id} className="border-t">
                          <td className="px-4 py-2 text-sm">
                            {line.item_number ? <BcItemCode value={line.item_number} /> : '-'}
                            {line.description ? ` · ${line.description}` : ''}
                          </td>
                          <td className="px-4 py-2 text-sm">{line.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {orderLines.map((line) => {
                    const item = line.item_number || ''
                    const selected = selectedItems.includes(item)
                    return (
                      <button
                        key={`card-${line.id}`}
                        type="button"
                        onClick={() => toggleItem(item)}
                        className={`min-h-[72px] rounded-xl border p-3 text-left transition ${
                          selected
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold text-slate-900">
                          {line.item_number ? <BcItemCode value={line.item_number} /> : 'Onbekend item'}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {line.quantity} st{line.description ? ` · ${line.description}` : ''}
                        </div>
                        {selected && (
                          <div className="mt-2 inline-flex rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                            Geselecteerd
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Nieuwe tijdsregistratie form */}
              <div className="rounded-xl bg-gray-50 p-4 shadow">
                <h3 className="text-lg font-semibold mb-4">Nieuwe Tijdsregistratie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Geselecteerde lijn(en)</label>
                    <div className="min-h-[48px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      {selectedItems.length === 0 ? (
                        <span className="text-slate-400">Tik hierboven één of meerdere lijnen aan</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedItems.map((item) => (
                            <span key={item} className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                              <BcItemCode value={item} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems(orderLines.map((line) => line.item_number || '').filter(Boolean))
                        }
                        className="min-h-[40px] flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Alle lijnen
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Wissen
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Werknemer(s)</label>
                    <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 sm:grid-cols-2">
                      {employees.map((emp) => (
                        <label
                          key={emp.id}
                          className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                            selectedEmployeeIds.includes(emp.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(emp.id)}
                            onChange={() => toggleEmployee(emp.id)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{emp.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Productiestap</label>
                    <select
                      value={selectedStep}
                      onChange={(e) => setSelectedStep(e.target.value)}
                      className="w-full px-3 py-3 min-h-[48px] border border-gray-300 rounded-lg shadow-sm"
                    >
                      {STEPS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="Andere">Andere</option>
                    </select>
                    {selectedStep === 'Andere' && (
                      <input
                        type="text"
                        value={customStep}
                        onChange={(e) => setCustomStep(e.target.value)}
                        placeholder="Typ stap..."
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg min-h-[40px]"
                      />
                    )}
                  </div>
                </div>
                <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
                  <button
                    type="button"
                    onClick={() => startRegistration()}
                    disabled={starting}
                    className="min-h-[52px] flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                  >
                    {starting
                      ? 'Bezig...'
                      : selectedEmployeeIds.length > 0 && selectedItems.length > 0
                        ? `Start (${selectedEmployeeIds.length} × ${selectedItems.length})`
                        : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startRegistration('Hout Halen')}
                    disabled={starting}
                    className="min-h-[52px] flex-1 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-60"
                  >
                    Hout Halen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <OrderBarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(orderNumber) => void openOrderByNumber(orderNumber)}
      />

      {/* Stop modal */}
      {stopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Stop tijdregistratie</h3>
            {stopModal.employeeName && (
              <p className="text-sm text-gray-600 mb-4">voor {stopModal.employeeName}</p>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hoeveel stuks afgewerkt? (max. {stopModal.lineQuantity})
            </label>
            <select
              value={stopQuantity}
              onChange={(e) => setStopQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 min-h-[44px]"
            >
              {Array.from({ length: stopModal.lineQuantity + 1 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'stuk' : 'stuks'}
                </option>
              ))}
            </select>
            {stopModal.lineQuantity === 1 && (
              <p className="text-xs text-gray-500 -mt-2 mb-2">
                Kies 0 als je het stuk niet klaar had tegen het einde van de shift.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStopModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => {
                  const qty = stopModal.lineQuantity > 1 ? stopQuantity : null
                  void doStop(stopModal.logId, qty)
                }}
                disabled={stopping}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60 min-h-[44px]"
              >
                {stopping ? 'Bezig...' : 'Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
