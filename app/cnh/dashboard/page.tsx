'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'

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

interface CNHSession {
  id: number
  session_type: 'pack' | 'load'
  location?: string
  started_at?: string
  stopped_at?: string
  packaging_minutes?: number
  packaging_count?: number
  packaging_persons?: number
  operator_minutes?: number
  loading_minutes?: number
  loading_count?: number
  loading_persons?: number
  load_reference?: string
  container_no?: string
  truck_plate?: string
  booking_ref?: string
  your_ref?: string
  container_tarra?: number
  container_photo_url?: string
  motors?: CNHMotor[]
}

interface CNHTemplate {
  id: number
  name: string
  load_location?: string
  load_reference?: string
  container_number?: string
  truck_plate?: string
  booking_ref?: string
  your_ref?: string
  container_tarra?: number
  created_at?: string
}

interface BodemStock {
  type: 'laag' | 'hoog'
  quantity: number
}

export default function CNHDashboardPage() {
  const [activeTab, setActiveTab] = useState<'pack' | 'load' | 'allmotors' | 'templates' | 'bodems'>('pack')
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  // Stats
  const [stats, setStats] = useState({
    received: 0,
    packaged: 0,
    loaded: 0,
    total: 0,
  })

  // Pack sessions
  const [packSessions, setPackSessions] = useState<CNHSession[]>([])
  const [loadSessions, setLoadSessions] = useState<CNHSession[]>([])

  // All motors
  const [allMotors, setAllMotors] = useState<CNHMotor[]>([])
  const [filteredMotors, setFilteredMotors] = useState<CNHMotor[]>([])
  const [motorFilters, setMotorFilters] = useState({
    state: '',
    location: '',
    search: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Templates
  const [templates, setTemplates] = useState<CNHTemplate[]>([])

  // Bodems
  const [bodemStock, setBodemStock] = useState<BodemStock[]>([])

  // Quick load settings
  const [quickLoadSettings, setQuickLoadSettings] = useState({
    loadReference: '',
    truckPlate: '',
    loadLocation: '',
  })

  // Edit modals state
  const [editingMotor, setEditingMotor] = useState<CNHMotor | null>(null)
  const [editingPackSession, setEditingPackSession] = useState<CNHSession | null>(null)
  const [editingLoadSession, setEditingLoadSession] = useState<CNHSession | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<CNHTemplate | null>(null)

  const showStatus = useCallback((text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 5000)
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const [receivedResp, packagedResp, loadedResp] = await Promise.all([
        fetch('/api/cnh/motors?state=received'),
        fetch('/api/cnh/motors?state=packaged'),
        fetch('/api/cnh/motors?state=loaded'),
      ])

      const received = await receivedResp.json()
      const packaged = await packagedResp.json()
      const loaded = await loadedResp.json()

      setStats({
        received: received?.length || 0,
        packaged: packaged?.length || 0,
        loaded: loaded?.length || 0,
        total: (received?.length || 0) + (packaged?.length || 0) + (loaded?.length || 0),
      })
    } catch (e) {
      console.error('Error fetching stats:', e)
    }
  }, [])

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/sessions')
      const data = await resp.json()
      if (resp.ok) {
        const pack = (data || []).filter((s: CNHSession) => s.session_type === 'pack')
        const load = (data || []).filter((s: CNHSession) => s.session_type === 'load')
        setPackSessions(pack)
        setLoadSessions(load)
      }
    } catch (e) {
      console.error('Error fetching sessions:', e)
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

  // Fetch bodems stock
  const fetchBodemStock = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/bodems-stock')
      const data = await resp.json()
      if (resp.ok) {
        setBodemStock(data || [])
      }
    } catch (e) {
      console.error('Error fetching bodems stock:', e)
    }
  }, [])

  // Filter motors
  useEffect(() => {
    let filtered = [...allMotors]

    if (motorFilters.state) {
      filtered = filtered.filter((m) => m.state === motorFilters.state)
    }
    if (motorFilters.location) {
      filtered = filtered.filter((m) => m.location === motorFilters.location)
    }
    if (motorFilters.search) {
      const search = motorFilters.search.toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.motor_nr.toLowerCase().includes(search) ||
          (m.shipping_note && m.shipping_note.toLowerCase().includes(search))
      )
    }

    setFilteredMotors(filtered)
    setCurrentPage(1)
  }, [allMotors, motorFilters])

  // Paginated motors
  const paginatedMotors = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredMotors.slice(start, end)
  }, [filteredMotors, currentPage, pageSize])

  const totalPages = Math.ceil(filteredMotors.length / pageSize)

  // Save quick load settings
  const saveQuickLoadSettings = useCallback(() => {
    try {
      localStorage.setItem('cnh_quick_load_settings', JSON.stringify(quickLoadSettings))
      showStatus('Instellingen opgeslagen voor workflow', 'success')
    } catch (e) {
      console.error('Error saving quick load settings:', e)
      showStatus('Fout bij opslaan instellingen', 'error')
    }
  }, [quickLoadSettings, showStatus])

  // Export functions
  const exportToCSV = useCallback(() => {
    const headers = ['ID', 'Motornummer', 'State', 'Locatie', 'Verzendnota', 'Ontvangen', 'Verpakt', 'Geladen']
    const rows = filteredMotors.map((m) => [
      m.id,
      m.motor_nr,
      m.state,
      m.location || '',
      m.shipping_note || '',
      m.received_at || '',
      m.packaged_at || '',
      m.loaded_at || '',
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cnh_motors_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showStatus('CSV geëxporteerd', 'success')
  }, [filteredMotors, showStatus])

  // Load on mount
  useEffect(() => {
    fetchStats()
    fetchSessions()
    fetchAllMotors()
    fetchTemplates()
    fetchBodemStock()

    // Load quick load settings
    try {
      const saved = localStorage.getItem('cnh_quick_load_settings')
      if (saved) {
        setQuickLoadSettings(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Error loading quick load settings:', e)
    }
  }, [fetchStats, fetchSessions, fetchAllMotors, fetchTemplates, fetchBodemStock])

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '0:00'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}:${String(m).padStart(2, '0')}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('nl-NL')
  }

  // Edit functions
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
      fetchStats()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken motor: ' + e.message, 'error')
    }
  }, [showStatus, fetchAllMotors, fetchStats])

  const updateSession = useCallback(async (session: CNHSession) => {
    try {
      const resp = await fetch(`/api/cnh/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij bijwerken sessie')
      }
      showStatus('Sessie bijgewerkt', 'success')
      setEditingPackSession(null)
      setEditingLoadSession(null)
      fetchSessions()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken sessie: ' + e.message, 'error')
    }
  }, [showStatus, fetchSessions])

  const updateTemplate = useCallback(async (template: CNHTemplate) => {
    try {
      const resp = await fetch(`/api/cnh/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij bijwerken template')
      }
      showStatus('Template bijgewerkt', 'success')
      setEditingTemplate(null)
      fetchTemplates()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken template: ' + e.message, 'error')
    }
  }, [showStatus, fetchTemplates])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-center mb-6">CNH Dashboard</h1>

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-3xl font-bold text-blue-600 mb-2">{stats.received}</h3>
          <p className="text-gray-600 font-medium">Ontvangen Motoren</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-3xl font-bold text-green-600 mb-2">{stats.packaged}</h3>
          <p className="text-gray-600 font-medium">Verpakte Motoren</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-3xl font-bold text-yellow-600 mb-2">{stats.loaded}</h3>
          <p className="text-gray-600 font-medium">Geladen Motoren</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-3xl font-bold text-gray-600 mb-2">{stats.total}</h3>
          <p className="text-gray-600 font-medium">Totaal Motoren</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Snelle acties</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cnh/workflow"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Naar Workflow
          </Link>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Exporteer CSV
          </button>
        </div>
      </div>

      {/* Quick Load Setup */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Laad Voorbereiding</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
            <input
              type="text"
              value={quickLoadSettings.loadReference}
              onChange={(e) =>
                setQuickLoadSettings({ ...quickLoadSettings, loadReference: e.target.value })
              }
              placeholder="bv: LOADREF123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nummerplaat</label>
            <input
              type="text"
              value={quickLoadSettings.truckPlate}
              onChange={(e) =>
                setQuickLoadSettings({ ...quickLoadSettings, truckPlate: e.target.value })
              }
              placeholder="bv: 1-ABC-123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Laad-locatie</label>
            <select
              value={quickLoadSettings.loadLocation}
              onChange={(e) =>
                setQuickLoadSettings({ ...quickLoadSettings, loadLocation: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecteer locatie...</option>
              <option value="China">China</option>
              <option value="Amerika">Amerika</option>
              <option value="UZB">UZB</option>
              <option value="Other">Anders</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveQuickLoadSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Opslaan voor Workflow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('pack')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pack'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Verpakking
          </button>
          <button
            onClick={() => setActiveTab('load')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'load'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lading
          </button>
          <button
            onClick={() => setActiveTab('allmotors')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'allmotors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alle Motoren
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('bodems')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'bodems'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Bodems Beheer
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Pack Sessions Tab */}
        {activeTab === 'pack' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Verpakkingssessies</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">ID</th>
                    <th className="px-4 py-2 text-left border-b">Locatie</th>
                    <th className="px-4 py-2 text-left border-b">Gestart</th>
                    <th className="px-4 py-2 text-left border-b">Gestopt</th>
                    <th className="px-4 py-2 text-left border-b">Tijd</th>
                    <th className="px-4 py-2 text-left border-b">Aantal</th>
                    <th className="px-4 py-2 text-left border-b">Operators</th>
                    <th className="px-4 py-2 text-left border-b">Operator Tijd</th>
                    <th className="px-4 py-2 text-left border-b">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {packSessions.map((session) => (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{session.id}</td>
                      <td className="px-4 py-2">{session.location || 'N/A'}</td>
                      <td className="px-4 py-2">{formatDate(session.started_at)}</td>
                      <td className="px-4 py-2">{formatDate(session.stopped_at)}</td>
                      <td className="px-4 py-2">{formatDuration(session.packaging_minutes)}</td>
                      <td className="px-4 py-2">{session.packaging_count || 0}</td>
                      <td className="px-4 py-2">{session.packaging_persons || 0}</td>
                      <td className="px-4 py-2">{formatDuration(session.operator_minutes)}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setEditingPackSession(session)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          Bewerken
                        </button>
                      </td>
                    </tr>
                  ))}
                  {packSessions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Geen verpakkingssessies gevonden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Load Sessions Tab */}
        {activeTab === 'load' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Lading-sessies</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">ID</th>
                    <th className="px-4 py-2 text-left border-b">Locatie</th>
                    <th className="px-4 py-2 text-left border-b">Laadreferentie</th>
                    <th className="px-4 py-2 text-left border-b">Container</th>
                    <th className="px-4 py-2 text-left border-b">Gestart</th>
                    <th className="px-4 py-2 text-left border-b">Gestopt</th>
                    <th className="px-4 py-2 text-left border-b">Tijd</th>
                    <th className="px-4 py-2 text-left border-b">Aantal</th>
                    <th className="px-4 py-2 text-left border-b">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {loadSessions.map((session) => (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{session.id}</td>
                      <td className="px-4 py-2">{session.location || 'N/A'}</td>
                      <td className="px-4 py-2">{session.load_reference || 'N/A'}</td>
                      <td className="px-4 py-2">{session.container_no || 'N/A'}</td>
                      <td className="px-4 py-2">{formatDate(session.started_at)}</td>
                      <td className="px-4 py-2">{formatDate(session.stopped_at)}</td>
                      <td className="px-4 py-2">{formatDuration(session.loading_minutes)}</td>
                      <td className="px-4 py-2">{session.loading_count || 0}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setEditingLoadSession(session)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          Bewerken
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loadSessions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Geen lading-sessies gevonden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Motors Tab */}
        {activeTab === 'allmotors' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Overzicht van Alle Motoren</h2>
            <div className="mb-4 flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State:</label>
                <select
                  value={motorFilters.state}
                  onChange={(e) => setMotorFilters({ ...motorFilters, state: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">(Alles)</option>
                  <option value="received">received</option>
                  <option value="packaged">packaged</option>
                  <option value="loaded">loaded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Locatie:</label>
                <select
                  value={motorFilters.location}
                  onChange={(e) => setMotorFilters({ ...motorFilters, location: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">(Alles)</option>
                  <option value="China">China</option>
                  <option value="Amerika">Amerika</option>
                  <option value="UZB">UZB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Zoekterm:</label>
                <input
                  type="text"
                  value={motorFilters.search}
                  onChange={(e) => setMotorFilters({ ...motorFilters, search: e.target.value })}
                  placeholder="Zoek in motornr of verzendnota..."
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setMotorFilters({ state: '', location: '', search: '' })}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Wissen
              </button>
            </div>
            <div className="mb-2 text-sm text-gray-600">
              Toont {filteredMotors.length} motoren (pagina {currentPage} van {totalPages})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">ID</th>
                    <th className="px-4 py-2 text-left border-b">Motornummer</th>
                    <th className="px-4 py-2 text-left border-b">State</th>
                    <th className="px-4 py-2 text-left border-b">Locatie</th>
                    <th className="px-4 py-2 text-left border-b">Verzendnota</th>
                    <th className="px-4 py-2 text-left border-b">Ontvangen</th>
                    <th className="px-4 py-2 text-left border-b">Verpakt</th>
                    <th className="px-4 py-2 text-left border-b">Geladen</th>
                    <th className="px-4 py-2 text-left border-b">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMotors.map((motor) => (
                    <tr key={motor.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{motor.id}</td>
                      <td className="px-4 py-2">{motor.motor_nr}</td>
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
                      <td className="px-4 py-2">{formatDate(motor.received_at)}</td>
                      <td className="px-4 py-2">{formatDate(motor.packaged_at)}</td>
                      <td className="px-4 py-2">{formatDate(motor.loaded_at)}</td>
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
                  {paginatedMotors.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Geen motoren gevonden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>Toon</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <span>per pagina</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Vorige
                  </button>
                  <span className="px-4 py-2">
                    Pagina {currentPage} van {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Laad Templates</h2>
            {templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Geen templates gevonden. Maak een nieuwe template aan in de workflow.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-300 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Bewerken
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {template.load_location && (
                        <div>
                          <span className="text-gray-600">Locatie:</span>
                          <div className="font-medium">{template.load_location}</div>
                        </div>
                      )}
                      {template.load_reference && (
                        <div>
                          <span className="text-gray-600">Laadreferentie:</span>
                          <div className="font-medium">{template.load_reference}</div>
                        </div>
                      )}
                      {template.container_number && (
                        <div>
                          <span className="text-gray-600">Container:</span>
                          <div className="font-medium">{template.container_number}</div>
                        </div>
                      )}
                      {template.truck_plate && (
                        <div>
                          <span className="text-gray-600">Nummerplaat:</span>
                          <div className="font-medium">{template.truck_plate}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bodems Tab */}
        {activeTab === 'bodems' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Bodem Voorraad</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">Type</th>
                    <th className="px-4 py-2 text-left border-b">Voorraad</th>
                  </tr>
                </thead>
                <tbody>
                  {bodemStock.map((stock) => (
                    <tr key={stock.type} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium capitalize">{stock.type}</td>
                      <td className="px-4 py-2">{stock.quantity}</td>
                    </tr>
                  ))}
                  {bodemStock.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                        Geen voorraad gevonden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
                      onChange={(e) => setEditingMotor({ ...editingMotor, state: e.target.value as 'received' | 'packaged' | 'loaded' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
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

      {/* Edit Pack Session Modal */}
      {editingPackSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Verpakkingssessie Bewerken</h2>
                <button
                  onClick={() => setEditingPackSession(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateSession(editingPackSession)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                    <input
                      type="text"
                      value={editingPackSession.location || ''}
                      onChange={(e) => setEditingPackSession({ ...editingPackSession, location: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packaging Minuten</label>
                    <input
                      type="number"
                      min="0"
                      value={editingPackSession.packaging_minutes || 0}
                      onChange={(e) => setEditingPackSession({ ...editingPackSession, packaging_minutes: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packaging Aantal</label>
                    <input
                      type="number"
                      min="0"
                      value={editingPackSession.packaging_count || 0}
                      onChange={(e) => setEditingPackSession({ ...editingPackSession, packaging_count: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packaging Personen</label>
                    <input
                      type="number"
                      min="0"
                      value={editingPackSession.packaging_persons || 0}
                      onChange={(e) => setEditingPackSession({ ...editingPackSession, packaging_persons: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Operator Minuten</label>
                    <input
                      type="number"
                      min="0"
                      value={editingPackSession.operator_minutes || 0}
                      onChange={(e) => setEditingPackSession({ ...editingPackSession, operator_minutes: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingPackSession(null)}
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

      {/* Edit Load Session Modal */}
      {editingLoadSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Laadsessie Bewerken</h2>
                <button
                  onClick={() => setEditingLoadSession(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateSession(editingLoadSession)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                    <input
                      type="text"
                      value={editingLoadSession.location || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, location: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
                    <input
                      type="text"
                      value={editingLoadSession.load_reference || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, load_reference: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Nummer</label>
                    <input
                      type="text"
                      value={editingLoadSession.container_no || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, container_no: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Truck Nummerplaat</label>
                    <input
                      type="text"
                      value={editingLoadSession.truck_plate || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, truck_plate: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Booking Ref</label>
                    <input
                      type="text"
                      value={editingLoadSession.booking_ref || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, booking_ref: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Ref</label>
                    <input
                      type="text"
                      value={editingLoadSession.your_ref || ''}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, your_ref: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Tarra</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingLoadSession.container_tarra || 0}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, container_tarra: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loading Minuten</label>
                    <input
                      type="number"
                      min="0"
                      value={editingLoadSession.loading_minutes || 0}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, loading_minutes: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loading Aantal</label>
                    <input
                      type="number"
                      min="0"
                      value={editingLoadSession.loading_count || 0}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, loading_count: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loading Personen</label>
                    <input
                      type="number"
                      min="0"
                      value={editingLoadSession.loading_persons || 0}
                      onChange={(e) => setEditingLoadSession({ ...editingLoadSession, loading_persons: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingLoadSession(null)}
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

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Template Bewerken</h2>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateTemplate(editingTemplate)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Naam</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                    <select
                      value={editingTemplate.load_location || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, load_location: e.target.value || undefined })}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
                    <input
                      type="text"
                      value={editingTemplate.load_reference || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, load_reference: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Nummer</label>
                    <input
                      type="text"
                      value={editingTemplate.container_number || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, container_number: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Truck Nummerplaat</label>
                    <input
                      type="text"
                      value={editingTemplate.truck_plate || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, truck_plate: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Booking Ref</label>
                    <input
                      type="text"
                      value={editingTemplate.booking_ref || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, booking_ref: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Ref</label>
                    <input
                      type="text"
                      value={editingTemplate.your_ref || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, your_ref: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Tarra</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingTemplate.container_tarra || 0}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, container_tarra: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
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
    </div>
  )
}

