'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface Employee {
  id: number
  name: string
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
}

const STEPS = ['Zagen', 'Hout Halen', 'Assemblage', 'Schuren', 'Afwerking']

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
  const [activeTab, setActiveTab] = useState<'actief' | 'afgewerkt'>('actief')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'order'>('recent')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [activeLogs, setActiveLogs] = useState<ActiveLog[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [modalOrder, setModalOrder] = useState<OrderRow | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  const [selectedItem, setSelectedItem] = useState('')
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

  const fetchEmployees = useCallback(async () => {
    const response = await fetch('/api/employees')
    if (!response.ok) return
    const data = await response.json()
    setEmployees(data || [])
  }, [])

  const fetchActiveLogs = useCallback(async () => {
    const response = await fetch('/api/production-order-time/active')
    if (!response.ok) return
    const data = await response.json()
    setActiveLogs(data || [])
  }, [])

  const fetchOrders = useCallback(async (finished: boolean, q: string) => {
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams()
      if (finished) params.set('finished', 'true')
      if (q) params.set('q', q)
      const response = await fetch(`/api/production-orders/list?${params.toString()}`)
      if (!response.ok) return
      const data = await response.json()
      setOrders(data.orders || [])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const fetchOrderLines = useCallback(async (orderNumber: string) => {
    if (!orderNumber) {
      setOrderLines([])
      return
    }
    const response = await fetch(`/api/production-orders/${encodeURIComponent(orderNumber)}/lines`)
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
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchActiveLogs(), fetchOrders(false, '')])
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [fetchEmployees, fetchActiveLogs, fetchOrders])

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
    setSelectedItem('')
    setSelectedStep(STEPS[0])
    setCustomStep('')
    await fetchOrderLines(order.order_number)
  }

  const closeOrderModal = () => {
    setModalOrder(null)
  }

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
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
    if (!modalOrder || !selectedItem) {
      alert('Selecteer een item')
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
          itemNumber: selectedItem,
          step,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Starten mislukt')
      }
      await fetchActiveLogs()
      setSelectedEmployeeIds([])
      alert('Tijdregistratie gestart')
    } catch (e: any) {
      alert(e.message || 'Starten mislukt')
    } finally {
      setStarting(false)
    }
  }

  const openStopModal = async (log: ActiveLog) => {
    const res = await fetch(`/api/production-orders/${encodeURIComponent(log.order_number)}/lines`)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Laden...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <h1 className="text-3xl font-bold text-center mb-8">Werkregistratie</h1>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <nav className="flex -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('actief')}
            className={`min-h-[48px] px-6 py-3 text-lg font-medium border-b-2 transition-colors ${
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
            className={`min-h-[48px] px-6 py-3 text-lg font-medium border-b-2 transition-colors ${
              activeTab === 'afgewerkt'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Afgewerkte Orders
          </button>
        </nav>
      </div>

      {/* Zoek en filters */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center">
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
                  key={order.order_number}
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
              key={order.order_number}
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white z-10 p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">Order Details – {modalOrder.order_number}</h2>
              <button
                type="button"
                onClick={closeOrderModal}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                aria-label="Sluit modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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
              {activeLogsForOrder.length > 0 && (
                <section className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Actieve Tijdsregistraties</h3>
                  <div className="space-y-3">
                    {activeLogsForOrder.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{log.employee_name}</span> – {log.item_number} · {log.step} ·{' '}
                          {formatElapsed(log.elapsed_seconds)}
                        </div>
                        <button
                          type="button"
                          onClick={() => openStopModal(log)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm min-h-[36px]"
                        >
                          Stop
                        </button>
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
                            {line.item_number || '-'}
                            {line.description ? ` · ${line.description}` : ''}
                          </td>
                          <td className="px-4 py-2 text-sm">{line.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Nieuwe tijdsregistratie form */}
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Nieuwe Tijdsregistratie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Item</label>
                    <select
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                      className="w-full px-3 py-3 min-h-[48px] border border-gray-300 rounded-lg shadow-sm"
                    >
                      <option value="">Selecteer item</option>
                      {orderLines.map((line) => (
                        <option key={line.id} value={line.item_number || ''}>
                          {line.item_number || 'Onbekend'} ({line.quantity} st)
                          {line.description ? ` – ${line.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Werknemer(s)</label>
                    <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto p-2">
                      {employees.map((emp) => (
                        <label
                          key={emp.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
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
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => startRegistration()}
                    disabled={starting}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow min-h-[48px] hover:bg-blue-700 disabled:opacity-60"
                  >
                    {starting ? 'Bezig...' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startRegistration('Hout Halen')}
                    disabled={starting}
                    className="px-6 py-3 bg-amber-500 text-white rounded-lg shadow min-h-[48px] hover:bg-amber-600 disabled:opacity-60"
                  >
                    Hout Halen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
