'use client'

import { useCallback, useEffect, useState } from 'react'

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

const STEPS = ['Zagen', 'Assemblage', 'Schuren', 'Afwerking']

export default function ProductionOrderTimePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  const [orderQuery, setOrderQuery] = useState('')
  const [orderOptions, setOrderOptions] = useState<string[]>([])
  const [selectedOrder, setSelectedOrder] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1)
  const [selectedStep, setSelectedStep] = useState(STEPS[0])
  const [customStep, setCustomStep] = useState('')
  const [activeLogs, setActiveLogs] = useState<ActiveLog[]>([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)

  const fetchEmployees = useCallback(async () => {
    const response = await fetch('/api/employees')
    if (!response.ok) throw new Error('Failed to fetch employees')
    const data = await response.json()
    setEmployees(data || [])
  }, [])

  const fetchActiveLogs = useCallback(async () => {
    const response = await fetch('/api/production-order-time/active')
    if (!response.ok) return
    const data = await response.json()
    setActiveLogs(data || [])
  }, [])

  const fetchOrders = useCallback(async (query: string) => {
    const params = new URLSearchParams()
    if (query) params.append('q', query)
    const response = await fetch(`/api/production-orders/list?${params.toString()}`)
    if (!response.ok) return
    const data = await response.json()
    setOrderOptions(data.orders || [])
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
    const lines = (data.lines || []).map((l: any) => ({
      ...l,
      quantity: Number(l.quantity) || 1,
    }))
    setOrderLines(lines)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchActiveLogs(), fetchOrders('')])
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [fetchEmployees, fetchActiveLogs, fetchOrders])

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchActiveLogs()
    }, 30000)
    return () => clearInterval(timer)
  }, [fetchActiveLogs])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchOrders(orderQuery)
    }, 250)
    return () => clearTimeout(timeout)
  }, [orderQuery, fetchOrders])

  useEffect(() => {
    void fetchOrderLines(selectedOrder)
    setSelectedItem('')
    setSelectedQuantity(1)
  }, [selectedOrder, fetchOrderLines])

  const selectedLine = orderLines.find((l) => (l.item_number || '') === selectedItem)

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    )
  }

  const handleStart = async () => {
    if (selectedEmployeeIds.length === 0) {
      alert('Selecteer minstens één medewerker')
      return
    }
    if (!selectedOrder || !selectedItem) {
      alert('Selecteer een order en item')
      return
    }
    const step = selectedStep === 'Andere' ? customStep.trim() : selectedStep
    if (!step) {
      alert('Selecteer een stap')
      return
    }

    setStarting(true)
    try {
      const qty = selectedLine && selectedLine.quantity > 1 ? selectedQuantity : null
      const response = await fetch('/api/production-order-time/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployeeIds,
          orderNumber: selectedOrder,
          itemNumber: selectedItem,
          step,
          quantity: qty,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Starten mislukt')
      }
      await fetchActiveLogs()
      setSelectedEmployeeIds([])
      alert('Tijdregistratie gestart')
    } catch (error: any) {
      alert(error.message || 'Starten mislukt')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async (logId: number, employeeName?: string) => {
    if (!confirm(`Stop tijdregistratie${employeeName ? ` voor ${employeeName}` : ''}?`)) {
      return
    }
    const response = await fetch(`/api/production-order-time/${logId}/stop`, { method: 'POST' })
    if (!response.ok) {
      alert('Stoppen mislukt')
      return
    }
    await fetchActiveLogs()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Productie Order Tijdregistratie</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Start registratie</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Medewerkers</label>
            <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto">
              {employees.map((employee) => (
                <label
                  key={employee.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                    className="w-4 h-4"
                  />
                  <span>{employee.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ordernummer</label>
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Zoek ordernummer..."
              />
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecteer order</option>
                {orderOptions.map((order) => (
                  <option key={order} value={order}>
                    {order}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Item</label>
              <select
                value={selectedItem}
                onChange={(e) => {
                  setSelectedItem(e.target.value)
                  const line = orderLines.find((l) => (l.item_number || '') === e.target.value)
                  setSelectedQuantity(line && line.quantity > 1 ? 1 : 1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!selectedOrder}
              >
                <option value="">Selecteer item</option>
                {orderLines.map((line) => (
                  <option key={line.id} value={line.item_number || ''}>
                    {line.item_number || 'Onbekend'} ({line.quantity} st)
                    {line.description ? ` - ${line.description}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedLine && selectedLine.quantity > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aantal stuks</label>
                <select
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Array.from({ length: selectedLine.quantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'stuk' : 'stuks'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stap</label>
              <select
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {STEPS.map((step) => (
                  <option key={step} value={step}>
                    {step}
                  </option>
                ))}
                <option value="Andere">Andere</option>
              </select>
              {selectedStep === 'Andere' && (
                <input
                  type="text"
                  value={customStep}
                  onChange={(e) => setCustomStep(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Typ stap..."
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleStart}
            disabled={starting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {starting ? 'Starten...' : 'Start tijdregistratie'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Actieve registraties</h2>
        {activeLogs.length === 0 ? (
          <div className="text-sm text-gray-500">Geen actieve registraties.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Medewerker</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aantal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stap</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acties</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.employee_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.item_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.quantity != null ? `${log.quantity} st` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.step}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(log.start_time).toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleStop(log.id, log.employee_name)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Stop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
