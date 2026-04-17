'use client'

import { useState, useEffect, useCallback } from 'react'

interface CNHMotor {
  id: number
  motor_nr: string
  type?: string
  location?: string
  shipping_note?: string
  state: 'to_check' | 'received' | 'packaged' | 'loaded'
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

interface CNHTemplate {
  id: number
  name: string
  load_location?: string | null
  load_reference?: string | null
  container_number?: string | null
  truck_plate?: string | null
  booking_ref?: string | null
  your_ref?: string | null
  container_tarra?: number | null
  created_at?: string
  updated_at?: string
}

type TemplateDraft = Omit<CNHTemplate, 'id' | 'created_at' | 'updated_at'> & { id?: number }

const EMPTY_TEMPLATE: TemplateDraft = {
  name: '',
  load_location: '',
  load_reference: '',
  container_number: '',
  truck_plate: '',
  booking_ref: '',
  your_ref: '',
  container_tarra: null,
}

export default function CNHAdminPage() {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [bodemsStock, setBodemsStock] = useState<BodemStock[]>([])
  const [allMotors, setAllMotors] = useState<CNHMotor[]>([])
  const [logs, setLogs] = useState<CNHLog[]>([])
  const [stockUpdate, setStockUpdate] = useState<Record<string, { quantity: number; operation: 'add' | 'subtract' | 'set' }>>({})
  const [editingMotor, setEditingMotor] = useState<CNHMotor | null>(null)
  const [templates, setTemplates] = useState<CNHTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<TemplateDraft | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

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

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/templates')
      const data = await resp.json()
      if (resp.ok) {
        setTemplates(data || [])
      }
    } catch (e) {
      console.error('Error fetching templates:', e)
    }
  }, [])

  const saveTemplate = useCallback(async () => {
    if (!editingTemplate) return
    if (!editingTemplate.name?.trim()) {
      showStatus('Template naam is verplicht', 'warning')
      return
    }

    setSavingTemplate(true)
    try {
      const payload = {
        name: editingTemplate.name.trim(),
        load_location: editingTemplate.load_location?.trim() || null,
        load_reference: editingTemplate.load_reference?.trim() || null,
        container_number: editingTemplate.container_number?.trim() || null,
        truck_plate: editingTemplate.truck_plate?.trim() || null,
        booking_ref: editingTemplate.booking_ref?.trim() || null,
        your_ref: editingTemplate.your_ref?.trim() || null,
        container_tarra:
          editingTemplate.container_tarra === null || editingTemplate.container_tarra === undefined
            ? null
            : Number(editingTemplate.container_tarra),
      }

      const isEdit = typeof editingTemplate.id === 'number'
      const url = isEdit ? `/api/cnh/templates/${editingTemplate.id}` : '/api/cnh/templates'
      const method = isEdit ? 'PUT' : 'POST'
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij opslaan template')
      }
      showStatus(isEdit ? 'Template bijgewerkt' : 'Template aangemaakt', 'success')
      setEditingTemplate(null)
      fetchTemplates()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij opslaan template: ' + e.message, 'error')
    } finally {
      setSavingTemplate(false)
    }
  }, [editingTemplate, showStatus, fetchTemplates])

  const deleteTemplate = useCallback(
    async (id: number, name: string) => {
      if (!confirm(`Template "${name}" verwijderen?`)) return
      try {
        const resp = await fetch(`/api/cnh/templates/${id}`, { method: 'DELETE' })
        const data = await resp.json()
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Fout bij verwijderen template')
        }
        showStatus('Template verwijderd', 'success')
        fetchTemplates()
      } catch (e: any) {
        console.error(e)
        showStatus('Fout bij verwijderen template: ' + e.message, 'error')
      }
    },
    [showStatus, fetchTemplates]
  )

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
    fetchTemplates()
  }, [fetchBodemsStock, fetchAllMotors, fetchLogs, fetchTemplates])

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('nl-NL')
  }

  // Update motor
  const updateMotor = useCallback(async (motor: CNHMotor) => {
    try {
      const resp = await fetch(`/api/cnh/motors/${motor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(motor),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij bijwerken motor')
      }
      showStatus('Motor bijgewerkt', 'success')
      setEditingMotor(null)
      fetchAllMotors()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken motor: ' + e.message, 'error')
    }
  }, [showStatus, fetchAllMotors])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-center mb-6">CNH Admin</h1>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Monitoring</h2>
        <div className="flex gap-4 flex-wrap">
          <a
            href="/admin/prepack"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            📊 Prepack Flow Monitoring
          </a>
          <a
            href="/admin/airtec"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          >
            📈 Airtec Flow Monitoring
          </a>
        </div>
      </div>

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

      {/* Laad-templates */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Laad-templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Maak hier op bureau de laad-templates aan. De mensen die de container laden
              kunnen ze dan in één klik selecteren op de <span className="font-medium">/cnh/workflow</span>-pagina,
              zonder zelf alle referenties te moeten overtypen.
            </p>
          </div>
          <button
            onClick={() => setEditingTemplate({ ...EMPTY_TEMPLATE })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nieuwe template
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left border-b text-sm">Naam</th>
                <th className="px-3 py-2 text-left border-b text-sm">Locatie</th>
                <th className="px-3 py-2 text-left border-b text-sm">Laad-ref</th>
                <th className="px-3 py-2 text-left border-b text-sm">Container</th>
                <th className="px-3 py-2 text-left border-b text-sm">Truck</th>
                <th className="px-3 py-2 text-left border-b text-sm">Booking</th>
                <th className="px-3 py-2 text-left border-b text-sm">Your ref</th>
                <th className="px-3 py-2 text-left border-b text-sm">Tarra</th>
                <th className="px-3 py-2 text-right border-b text-sm">Acties</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2">{t.load_location || '—'}</td>
                  <td className="px-3 py-2 text-sm">{t.load_reference || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono">{t.container_number || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono">{t.truck_plate || '—'}</td>
                  <td className="px-3 py-2 text-sm">{t.booking_ref || '—'}</td>
                  <td className="px-3 py-2 text-sm">{t.your_ref || '—'}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    {t.container_tarra !== null && t.container_tarra !== undefined ? t.container_tarra : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          setEditingTemplate({
                            id: t.id,
                            name: t.name,
                            load_location: t.load_location || '',
                            load_reference: t.load_reference || '',
                            container_number: t.container_number || '',
                            truck_plate: t.truck_plate || '',
                            booking_ref: t.booking_ref || '',
                            your_ref: t.your_ref || '',
                            container_tarra: t.container_tarra ?? null,
                          })
                        }
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id, t.name)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Nog geen templates. Klik op &quot;+ Nieuwe template&quot; om er een aan te maken.
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
                <th className="px-4 py-2 text-left border-b">Acties</th>
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
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setEditingMotor(motor)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Bewerken
                    </button>
                  </td>
                </tr>
              ))}
              {allMotors.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
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

      {/* Edit Motor Modal */}
      {editingMotor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Motor Bewerken</h2>
                <button
                  onClick={() => setEditingMotor(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateMotor(editingMotor)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motornummer</label>
                    <input
                      type="text"
                      value={editingMotor.motor_nr}
                      onChange={(e) => setEditingMotor({ ...editingMotor, motor_nr: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <select
                      value={editingMotor.state}
                      onChange={(e) => setEditingMotor({ ...editingMotor, state: e.target.value as 'to_check' | 'received' | 'packaged' | 'loaded' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="to_check">to_check</option>
                      <option value="received">received</option>
                      <option value="packaged">packaged</option>
                      <option value="loaded">loaded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                    <select
                      value={editingMotor.location || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, location: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecteer...</option>
                      <option value="China">China</option>
                      <option value="Amerika">Amerika</option>
                      <option value="UZB">UZB</option>
                      <option value="Other">Anders</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verzendnota</label>
                    <input
                      type="text"
                      value={editingMotor.shipping_note || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, shipping_note: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bodem Laag</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMotor.bodem_low || 0}
                      onChange={(e) => setEditingMotor({ ...editingMotor, bodem_low: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bodem Hoog</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMotor.bodem_high || 0}
                      onChange={(e) => setEditingMotor({ ...editingMotor, bodem_high: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
                    <input
                      type="text"
                      value={editingMotor.load_reference || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, load_reference: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Nummer</label>
                    <input
                      type="text"
                      value={editingMotor.container_number || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, container_number: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Truck Nummerplaat</label>
                    <input
                      type="text"
                      value={editingMotor.truck_plate || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, truck_plate: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingMotor(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Opslaan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Template edit/create modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {typeof editingTemplate.id === 'number' ? 'Template bewerken' : 'Nieuwe template'}
                </h2>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                  disabled={savingTemplate}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  saveTemplate()
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template naam <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="bv. China CNH januari"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Dit is de naam die de laders zien wanneer ze de template kiezen. Kies iets duidelijk zoals klantnaam + land + week.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laad-locatie</label>
                    <select
                      value={editingTemplate.load_location || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, load_location: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">—</option>
                      <option value="China">China</option>
                      <option value="Amerika">Amerika</option>
                      <option value="UZB">UZB</option>
                      <option value="Other">Anders</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
                    <input
                      type="text"
                      value={editingTemplate.load_reference || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, load_reference: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container nummer</label>
                    <input
                      type="text"
                      value={editingTemplate.container_number || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, container_number: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Truck nummerplaat</label>
                    <input
                      type="text"
                      value={editingTemplate.truck_plate || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, truck_plate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Booking reference</label>
                    <input
                      type="text"
                      value={editingTemplate.booking_ref || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, booking_ref: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your reference</label>
                    <input
                      type="text"
                      value={editingTemplate.your_ref || ''}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, your_ref: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container tarra (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        editingTemplate.container_tarra === null ||
                        editingTemplate.container_tarra === undefined
                          ? ''
                          : editingTemplate.container_tarra
                      }
                      onChange={(e) => {
                        const v = e.target.value
                        setEditingTemplate({
                          ...editingTemplate,
                          container_tarra: v === '' ? null : Number(v),
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    disabled={savingTemplate}
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={savingTemplate}
                  >
                    {savingTemplate ? 'Bezig...' : 'Opslaan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

