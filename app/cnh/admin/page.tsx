'use client'

import { useState, useEffect, useCallback } from 'react'

interface CNHMotor {
  id: number
  motor_nr: string
  type?: string
  location?: string
  shipping_note?: string
  state: 'received' | 'packaged' | 'loaded'
  bodem_low?: number
  bodem_high?: number
  received_at?: string
  packaged_at?: string
  loaded_at?: string
  load_reference?: string
  container_number?: string
  truck_plate?: string
}

interface BodemStock {
  type: 'laag' | 'hoog'
  quantity: number
}

interface CNHLog {
  id: number
  action: string
  details?: any
  created_at?: string
}

export default function CNHAdminPage() {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [bodemsStock, setBodemsStock] = useState<BodemStock[]>([])
  const [allMotors, setAllMotors] = useState<CNHMotor[]>([])
  const [logs, setLogs] = useState<CNHLog[]>([])
  const [stockUpdate, setStockUpdate] = useState<Record<string, { quantity: number; operation: 'add' | 'subtract' | 'set' }>>({})

  const showStatus = useCallback((text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 5000)
  }, [])

  // Fetch bodems stock
  const fetchBodemsStock = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/bodems-stock')
      const data = await resp.json()
      if (resp.ok) {
        setBodemsStock(data || [])
        // Initialize stock update state
        const updateState: Record<string, { quantity: number; operation: 'add' | 'subtract' | 'set' }> = {}
        data.forEach((stock: BodemStock) => {
          updateState[stock.type] = { quantity: 0, operation: 'set' }
        })
        setStockUpdate(updateState)
      }
    } catch (e) {
      console.error('Error fetching bodems stock:', e)
    }
  }, [])

  // Fetch all motors
  const fetchAllMotors = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/motors')
      const data = await resp.json()
      if (resp.ok) {
        setAllMotors(data || [])
      }
    } catch (e) {
      console.error('Error fetching all motors:', e)
    }
  }, [])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/logs?limit=100')
      const data = await resp.json()
      if (resp.ok) {
        setLogs(data || [])
      }
    } catch (e) {
      console.error('Error fetching logs:', e)
    }
  }, [])

  // Update bodem stock
  const updateBodemStock = useCallback(async (type: 'laag' | 'hoog', quantity: number, operation: 'add' | 'subtract' | 'set') => {
    try {
      const resp = await fetch('/api/cnh/bodems-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity, operation }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij bijwerken voorraad')
      }
      showStatus(`Voorraad ${type} bijgewerkt`, 'success')
      fetchBodemsStock()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken voorraad: ' + e.message, 'error')
    }
  }, [showStatus, fetchBodemsStock])

  // Load on mount
  useEffect(() => {
    fetchBodemsStock()
    fetchAllMotors()
    fetchLogs()
  }, [fetchBodemsStock, fetchAllMotors, fetchLogs])

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('nl-NL')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-center mb-6">CNH Admin</h1>

      {/* Status messages */}
      {statusMessage && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            statusMessage.type === 'success'
              ? 'bg-green-100 text-green-800'
              : statusMessage.type === 'error'
              ? 'bg-red-100 text-red-800'
              : statusMessage.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Bodems Voorraad */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Bodems Voorraad</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left border-b">Type</th>
                <th className="px-4 py-2 text-left border-b">Huidige Voorraad</th>
                <th className="px-4 py-2 text-left border-b">Acties</th>
              </tr>
            </thead>
            <tbody>
              {bodemsStock.map((stock) => (
                <tr key={stock.type} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium capitalize">{stock.type}</td>
                  <td className="px-4 py-2 text-lg font-semibold">{stock.quantity}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 items-center">
                      <select
                        value={stockUpdate[stock.type]?.operation || 'set'}
                        onChange={(e) => {
                          setStockUpdate({
                            ...stockUpdate,
                            [stock.type]: {
                              ...stockUpdate[stock.type],
                              operation: e.target.value as 'add' | 'subtract' | 'set',
                            },
                          })
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="add">Toevoegen</option>
                        <option value="subtract">Aftrekken</option>
                        <option value="set">Instellen</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={stockUpdate[stock.type]?.quantity || 0}
                        onChange={(e) => {
                          setStockUpdate({
                            ...stockUpdate,
                            [stock.type]: {
                              ...stockUpdate[stock.type],
                              quantity: parseInt(e.target.value) || 0,
                              operation: stockUpdate[stock.type]?.operation || 'set',
                            },
                          })
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                        placeholder="Aantal"
                      />
                      <button
                        onClick={() => {
                          const update = stockUpdate[stock.type]
                          if (update) {
                            updateBodemStock(stock.type, update.quantity, update.operation)
                          }
                        }}
                        className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Bijwerken
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {bodemsStock.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Geen voorraad gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alle Motoren */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Alle Motoren</h2>
        <div className="mb-2 text-sm text-gray-600">Totaal: {allMotors.length} motoren</div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left border-b">ID</th>
                <th className="px-4 py-2 text-left border-b">Motornummer</th>
                <th className="px-4 py-2 text-left border-b">State</th>
                <th className="px-4 py-2 text-left border-b">Locatie</th>
                <th className="px-4 py-2 text-left border-b">Verzendnota</th>
                <th className="px-4 py-2 text-left border-b">Bodem Laag</th>
                <th className="px-4 py-2 text-left border-b">Bodem Hoog</th>
                <th className="px-4 py-2 text-left border-b">Ontvangen</th>
                <th className="px-4 py-2 text-left border-b">Verpakt</th>
                <th className="px-4 py-2 text-left border-b">Geladen</th>
                <th className="px-4 py-2 text-left border-b">Laadreferentie</th>
                <th className="px-4 py-2 text-left border-b">Container</th>
              </tr>
            </thead>
            <tbody>
              {allMotors.map((motor) => (
                <tr key={motor.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{motor.id}</td>
                  <td className="px-4 py-2 font-medium">{motor.motor_nr}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        motor.state === 'received'
                          ? 'bg-blue-100 text-blue-800'
                          : motor.state === 'packaged'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {motor.state}
                    </span>
                  </td>
                  <td className="px-4 py-2">{motor.location || 'N/A'}</td>
                  <td className="px-4 py-2">{motor.shipping_note || 'N/A'}</td>
                  <td className="px-4 py-2">{motor.bodem_low || 0}</td>
                  <td className="px-4 py-2">{motor.bodem_high || 0}</td>
                  <td className="px-4 py-2 text-sm">{formatDate(motor.received_at)}</td>
                  <td className="px-4 py-2 text-sm">{formatDate(motor.packaged_at)}</td>
                  <td className="px-4 py-2 text-sm">{formatDate(motor.loaded_at)}</td>
                  <td className="px-4 py-2">{motor.load_reference || 'N/A'}</td>
                  <td className="px-4 py-2">{motor.container_number || 'N/A'}</td>
                </tr>
              ))}
              {allMotors.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    Geen motoren gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Logs</h2>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left border-b">ID</th>
                <th className="px-4 py-2 text-left border-b">Actie</th>
                <th className="px-4 py-2 text-left border-b">Details</th>
                <th className="px-4 py-2 text-left border-b">Datum</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{log.id}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-1 bg-gray-200 rounded text-sm font-semibold">{log.action}</span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                  <td className="px-4 py-2 text-sm">{formatDate(log.created_at)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Geen logs gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

