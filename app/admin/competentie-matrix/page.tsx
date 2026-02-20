'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  LayoutGrid,
  Settings,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  Users,
  Cpu,
  ShieldAlert,
  TrendingUp,
  Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee { id: number; name: string; active: boolean }
interface Machine  { id: number; name: string; description: string | null; category: string; active: boolean; sort_order: number }
interface Competency { id: number; employee_id: number; machine_id: number; level: number; notes: string | null }
interface DailyStatus { id: number; employee_id: number; date: string; status: string; assigned_machine_id: number | null; notes: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS = [
  { value: 0, label: '—',  desc: 'Geen kennis',   bg: 'bg-gray-100',    text: 'text-gray-400',  ring: '',                  dot: 'bg-gray-200',   cell: 'bg-gray-50 hover:bg-gray-100' },
  { value: 1, label: '1',  desc: 'In opleiding',  bg: 'bg-yellow-100',  text: 'text-yellow-700', ring: 'ring-yellow-300',   dot: 'bg-yellow-400', cell: 'bg-yellow-50 hover:bg-yellow-100' },
  { value: 2, label: '2',  desc: 'Basiskennis',   bg: 'bg-blue-100',    text: 'text-blue-700',  ring: 'ring-blue-300',     dot: 'bg-blue-400',   cell: 'bg-blue-50 hover:bg-blue-100' },
  { value: 3, label: '3',  desc: 'Gevorderd',     bg: 'bg-indigo-100',  text: 'text-indigo-700', ring: 'ring-indigo-300',  dot: 'bg-indigo-500', cell: 'bg-indigo-50 hover:bg-indigo-100' },
  { value: 4, label: '4',  desc: 'Expert',        bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-300', dot: 'bg-emerald-500', cell: 'bg-emerald-50 hover:bg-emerald-100' },
]

const STATUSES = [
  { value: 'aanwezig',  label: 'Aanwezig',  short: 'A',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-400' },
  { value: 'afwezig',   label: 'Afwezig',   short: 'AF', color: 'bg-red-100 text-red-800 border-red-200',             dot: 'bg-red-400' },
  { value: 'verlof',    label: 'Verlof',    short: 'V',  color: 'bg-blue-100 text-blue-800 border-blue-200',          dot: 'bg-blue-400' },
  { value: 'ziek',      label: 'Ziek',      short: 'Z',  color: 'bg-orange-100 text-orange-800 border-orange-200',    dot: 'bg-orange-400' },
  { value: 'thuiswerk', label: 'Thuiswerk', short: 'TW', color: 'bg-purple-100 text-purple-800 border-purple-200',    dot: 'bg-purple-400' },
]

const CATEGORIES = ['machine', 'werkplek', 'overig']

const AVATAR_COLORS = [
  'bg-blue-500','bg-indigo-500','bg-violet-500','bg-purple-500',
  'bg-pink-500','bg-rose-500','bg-orange-500','bg-amber-500',
  'bg-teal-500','bg-cyan-500','bg-sky-500','bg-emerald-500',
]

const toDateInput = (d: Date) => d.toISOString().split('T')[0]
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length]

// ─── Small helpers ────────────────────────────────────────────────────────────

function Avatar({ employee, size = 'md' }: { employee: Employee; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
  return (
    <span className={`${sz} rounded-full ${avatarColor(employee.id)} text-white font-bold flex items-center justify-center shrink-0 select-none`}>
      {employee.name.charAt(0).toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status) ?? STATUSES[0]
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
}

function LevelCell({ level, onClick, saving }: { level: number; onClick: () => void; saving?: boolean }) {
  const l = LEVELS[level] ?? LEVELS[0]
  if (saving) return <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" /></div>
  return (
    <button
      type="button"
      onClick={onClick}
      title={l.desc}
      className={`w-full h-full flex items-center justify-center rounded transition-colors cursor-pointer ${l.cell}`}
    >
      {level === 0
        ? <span className="text-gray-300 text-sm select-none">·</span>
        : <span className={`text-xs font-bold select-none ${l.text}`}>{l.label}</span>
      }
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompetentieMatrixPage() {
  const [tab, setTab] = useState<'matrix' | 'machines' | 'dagplanning'>('matrix')

  const [employees, setEmployees]     = useState<Employee[]>([])
  const [machines, setMachines]       = useState<Machine[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [dailyStatuses, setDailyStatuses] = useState<DailyStatus[]>([])
  const [selectedDate, setSelectedDate]   = useState(toDateInput(new Date()))
  const [loadingMatrix, setLoadingMatrix] = useState(true)
  const [loadingPlanning, setLoadingPlanning] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [copyingYesterday, setCopyingYesterday] = useState(false)

  // Machine form
  const [machineForm, setMachineForm]   = useState<Partial<Machine> | null>(null)
  const [machineError, setMachineError] = useState('')
  const [savingMachine, setSavingMachine] = useState(false)

  // Level picker popup
  const [levelPopup, setLevelPopup] = useState<{ employeeId: number; machineId: number } | null>(null)
  // Machine detail popup (click column header)
  const [machineDetailPopup, setMachineDetailPopup] = useState<Machine | null>(null)

  // Filters
  const [showInactive, setShowInactive]   = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [employeeSearch, setEmployeeSearch] = useState('')

  // ── Authenticated fetch helper ─────────────────────────────────────────────

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return fetch(url, { ...options, headers })
  }, [])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBase = useCallback(async () => {
    setLoadingMatrix(true)
    setFetchError(null)
    try {
      const [empRes, machRes, compRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/machines'),
        fetch('/api/competencies'),
      ])
      if (!empRes.ok || !machRes.ok || !compRes.ok) {
        setFetchError('Fout bij laden van data. Vernieuw de pagina.')
        return
      }
      const [empData, machData, compData] = await Promise.all([
        empRes.json(), machRes.json(), compRes.json(),
      ])
      setEmployees(empData)
      setMachines(machData)
      setCompetencies(compData)
    } catch {
      setFetchError('Netwerkfout bij laden. Controleer je verbinding.')
    } finally {
      setLoadingMatrix(false)
    }
  }, [])

  const fetchPlanning = useCallback(async (date: string) => {
    setLoadingPlanning(true)
    try {
      const res = await fetch(`/api/dagplanning?date=${date}`)
      if (res.ok) setDailyStatuses(await res.json())
      else setFetchError('Fout bij laden van dagplanning.')
    } catch {
      setFetchError('Netwerkfout bij laden van dagplanning.')
    } finally {
      setLoadingPlanning(false)
    }
  }, [])

  useEffect(() => { void fetchBase() }, [fetchBase])
  useEffect(() => { void fetchPlanning(selectedDate) }, [fetchPlanning, selectedDate])

  // ── Derived data ───────────────────────────────────────────────────────────

  const activeEmployees = employees.filter((e) => e.active)
  const visibleEmployees = employees.filter((e) => {
    if (!showInactive && !e.active) return false
    if (employeeSearch && !e.name.toLowerCase().includes(employeeSearch.toLowerCase())) return false
    return true
  })
  const visibleMachines = machines.filter(
    (m) => m.active && (categoryFilter === 'all' || m.category === categoryFilter)
  )

  // O(1) lookup map: "employeeId-machineId" → level
  const competencyMap = useMemo(() => {
    const map = new Map<string, number>()
    competencies.forEach((c) => map.set(`${c.employee_id}-${c.machine_id}`, c.level))
    return map
  }, [competencies])

  const getLevel = useCallback(
    (employeeId: number, machineId: number) =>
      competencyMap.get(`${employeeId}-${machineId}`) ?? 0,
    [competencyMap]
  )

  const getDailyStatus = useCallback(
    (employeeId: number) => dailyStatuses.find((s) => s.employee_id === employeeId),
    [dailyStatuses]
  )

  // Per machine: how many active employees have level >= 2
  const machineQualified = useMemo(() => {
    const map: Record<number, Employee[]> = {}
    machines.forEach((m) => {
      map[m.id] = activeEmployees.filter((e) => getLevel(e.id, m.id) >= 2)
    })
    return map
  }, [machines, activeEmployees, getLevel])

  // Per employee: how many active machines they can operate (level >= 2)
  const employeeMachineCount = useMemo(() => {
    const map: Record<number, number> = {}
    employees.forEach((e) => {
      map[e.id] = machines.filter((m) => m.active && getLevel(e.id, m.id) >= 2).length
    })
    return map
  }, [machines, employees, getLevel])

  // Coverage stats
  const activeMachines = machines.filter((m) => m.active)
  const atRiskMachines = activeMachines.filter((m) => (machineQualified[m.id]?.length ?? 0) < 2)
  const coverageScore = activeMachines.length > 0
    ? Math.round(((activeMachines.length - atRiskMachines.length) / activeMachines.length) * 100)
    : 100
  const totalCompetencies = competencies.filter(
    (c) => c.level >= 2 && machines.find((m) => m.id === c.machine_id && m.active)
  ).length
  const avgCompetenciesPerEmployee = activeEmployees.length > 0
    ? (totalCompetencies / activeEmployees.length).toFixed(1)
    : '0'

  // Dagplanning derived
  const presentEmployees = visibleEmployees.filter((e) => {
    const s = getDailyStatus(e.id)
    return !s || s.status === 'aanwezig' || s.status === 'thuiswerk'
  })
  const absentEmployees = visibleEmployees.filter((e) => {
    const s = getDailyStatus(e.id)
    return s && (s.status === 'afwezig' || s.status === 'verlof' || s.status === 'ziek')
  })

  // ── Competency actions ─────────────────────────────────────────────────────

  const handleSetLevel = async (level: number) => {
    if (!levelPopup) return
    const { employeeId, machineId } = levelPopup
    setLevelPopup(null)

    // Optimistic update: meteen de UI bijwerken
    const prevCompetencies = competencies
    setCompetencies((prev) => {
      const idx = prev.findIndex((c) => c.employee_id === employeeId && c.machine_id === machineId)
      const optimistic = { id: -1, employee_id: employeeId, machine_id: machineId, level, notes: null }
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], level }; return n }
      return [...prev, optimistic]
    })

    setSaving(`${employeeId}-${machineId}`)
    try {
      const res = await authFetch('/api/competencies', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, machine_id: machineId, level }),
      })
      if (res.ok) {
        // Vervang optimistic record met server response (krijgt echte ID)
        const updated = await res.json()
        setCompetencies((prev) => {
          const idx = prev.findIndex((c) => c.employee_id === employeeId && c.machine_id === machineId)
          if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
          return [...prev, updated]
        })
      } else {
        // Rollback bij fout
        setCompetencies(prevCompetencies)
        setFetchError('Fout bij opslaan van competentie. Probeer opnieuw.')
      }
    } catch {
      setCompetencies(prevCompetencies)
      setFetchError('Netwerkfout bij opslaan van competentie.')
    } finally { setSaving(null) }
  }

  // ── Daily status actions ───────────────────────────────────────────────────

  const handleStatusChange = async (employeeId: number, status: string, assignedMachineId?: number | null) => {
    setSaving(`status-${employeeId}`)
    try {
      const current = getDailyStatus(employeeId)
      const res = await authFetch('/api/dagplanning', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId, date: selectedDate, status,
          assigned_machine_id: assignedMachineId ?? current?.assigned_machine_id ?? null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDailyStatuses((prev) => {
          const idx = prev.findIndex((s) => s.employee_id === employeeId)
          if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
          return [...prev, updated]
        })
      }
    } finally { setSaving(null) }
  }

  const handleMachineAssign = (employeeId: number, machineId: number | null) => {
    const current = getDailyStatus(employeeId)
    void handleStatusChange(employeeId, current?.status ?? 'aanwezig', machineId)
  }

  // Copy yesterday's planning to selected date — parallel requests
  const handleCopyYesterday = async () => {
    setCopyingYesterday(true)
    try {
      const prev = new Date(selectedDate)
      prev.setDate(prev.getDate() - 1)
      const yesterdayStr = toDateInput(prev)
      const res = await fetch(`/api/dagplanning?date=${yesterdayStr}`)
      if (!res.ok) { setFetchError('Kon planning van gisteren niet ophalen.'); return }
      const yesterdayStatuses: DailyStatus[] = await res.json()
      if (yesterdayStatuses.length === 0) { setFetchError('Geen planning gevonden voor gisteren.'); return }

      // Alle statussen parallel versturen
      await Promise.all(
        yesterdayStatuses.map((s) =>
          authFetch('/api/dagplanning', {
            method: 'POST',
            body: JSON.stringify({
              employee_id: s.employee_id, date: selectedDate,
              status: s.status, assigned_machine_id: s.assigned_machine_id,
            }),
          })
        )
      )
      void fetchPlanning(selectedDate)
    } catch {
      setFetchError('Fout bij kopiëren van planning.')
    } finally {
      setCopyingYesterday(false)
    }
  }

  // Navigate date
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(toDateInput(d))
  }

  // ── Machine CRUD ───────────────────────────────────────────────────────────

  const openNewMachine  = () => { setMachineForm({ name: '', description: '', category: 'machine', active: true, sort_order: 0 }); setMachineError('') }
  const openEditMachine = (m: Machine) => { setMachineForm({ ...m }); setMachineError('') }

  const saveMachine = async () => {
    if (!machineForm) return
    if (!machineForm.name?.trim()) { setMachineError('Naam is verplicht'); return }
    setSavingMachine(true); setMachineError('')
    try {
      const isNew = !machineForm.id
      const res = await authFetch('/api/machines', {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(machineForm),
      })
      if (!res.ok) { const e = await res.json(); setMachineError(e.error ?? 'Fout bij opslaan'); return }
      const saved = await res.json()
      setMachines((prev) => isNew ? [...prev, saved] : prev.map((m) => (m.id === saved.id ? saved : m)))
      setMachineForm(null)
    } finally { setSavingMachine(false) }
  }

  const deleteMachine = async (id: number) => {
    if (!confirm('Machine verwijderen? Dit verwijdert ook alle gekoppelde competenties.')) return
    const res = await authFetch(`/api/machines?id=${id}`, { method: 'DELETE' })
    if (res.ok) { setMachines((prev) => prev.filter((m) => m.id !== id)); setCompetencies((prev) => prev.filter((c) => c.machine_id !== id)) }
  }

  const toggleMachineActive = async (m: Machine) => {
    const res = await authFetch('/api/machines', { method: 'PATCH', body: JSON.stringify({ id: m.id, active: !m.active }) })
    if (res.ok) { const updated = await res.json(); setMachines((prev) => prev.map((x) => (x.id === updated.id ? updated : x))) }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1500px]">

      {/* Globale foutmelding */}
      {fetchError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{fetchError}</span>
          <button type="button" onClick={() => setFetchError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-3">← Admin</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Competentie Matrix</h1>
            <p className="mt-1 text-gray-500 text-sm">Competenties, machines en dagplanning van medewerkers</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {([
            { id: 'matrix'     as const, label: 'Competentie Matrix',      icon: <LayoutGrid className="w-4 h-4" /> },
            { id: 'machines'   as const, label: 'Machines & Werkplekken',   icon: <Settings   className="w-4 h-4" /> },
            { id: 'dagplanning'as const, label: 'Dagplanning',              icon: <CalendarDays className="w-4 h-4" /> },
          ]).map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ════════════════════ TAB: MATRIX ════════════════════ */}
      {tab === 'matrix' && (
        <div>
          {/* KPI Cards */}
          {!loadingMatrix && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Medewerkers</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{activeEmployees.length}</div>
                <div className="text-xs text-gray-400">actief</div>
              </div>
              <div className="bg-white rounded-xl border-l-4 border-indigo-500 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Machines</span>
                  <Cpu className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{activeMachines.length}</div>
                <div className="text-xs text-gray-400">actief</div>
              </div>
              <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${atRiskMachines.length > 0 ? 'border-red-500' : 'border-emerald-500'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Risico</span>
                  <ShieldAlert className={`w-4 h-4 ${atRiskMachines.length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                </div>
                <div className={`text-2xl font-bold ${atRiskMachines.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{atRiskMachines.length}</div>
                <div className="text-xs text-gray-400">machine(s) &lt; 2 gekwalificeerd</div>
              </div>
              <div className="bg-white rounded-xl border-l-4 border-teal-500 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Bezettingsscore</span>
                  <TrendingUp className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{coverageScore}%</div>
                <div className="text-xs text-gray-400">gem. {avgCompetenciesPerEmployee} machines/mdw</div>
              </div>
            </div>
          )}

          {/* Coverage risk alert */}
          {!loadingMatrix && atRiskMachines.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm font-semibold text-red-700">
                  {atRiskMachines.length} machine(s) met te weinig gekwalificeerde medewerkers (&lt; 2)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {atRiskMachines.map((m) => {
                  const count = machineQualified[m.id]?.length ?? 0
                  return (
                    <span key={m.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${count === 0 ? 'bg-red-200 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                      {m.name}
                      <span className="font-bold">{count === 0 ? 'Niemand' : `${count} persoon`}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek medewerker…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              />
            </div>

            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(['all', ...CATEGORIES] as const).map((c, i) => (
                <button key={c} type="button" onClick={() => setCategoryFilter(c)}
                  className={`px-3 py-1.5 capitalize ${i > 0 ? 'border-l border-gray-200' : ''} ${categoryFilter === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {c === 'all' ? 'Alles' : c}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gray-300" />
              Inactieve medewerkers
            </label>

            {/* Legend */}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {LEVELS.map((l) => (
                <span key={l.value} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${l.bg} ${l.text}`}>
                    {l.value === 0 ? '·' : l.label}
                  </span>
                  {l.desc}
                </span>
              ))}
            </div>
          </div>

          {loadingMatrix ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
            </div>
          ) : visibleMachines.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">Geen machines gevonden</p>
              <button type="button" onClick={() => setTab('machines')} className="text-sm text-blue-600 hover:underline">Voeg een machine of werkplek toe →</button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-auto shadow-sm">
              <table className="border-collapse text-sm" style={{ minWidth: `${180 + visibleMachines.length * 80 + 60}px` }}>
                <thead>
                  <tr className="bg-gray-50">
                    {/* Employee header */}
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[200px]">
                      <div className="flex items-center gap-1">
                        Medewerker
                        <span className="ml-1 text-xs font-normal text-gray-400">({visibleEmployees.length})</span>
                      </div>
                    </th>
                    {/* Machine columns */}
                    {visibleMachines.map((m) => {
                      const qualified = machineQualified[m.id] ?? []
                      const isAtRisk = qualified.length < 2
                      return (
                        <th key={m.id}
                          className={`px-1 py-2 text-center border-b border-r border-gray-100 min-w-[76px] cursor-pointer hover:bg-gray-100 transition-colors group ${isAtRisk ? 'bg-red-50' : 'bg-gray-50'}`}
                          onClick={() => setMachineDetailPopup(m)}>
                          <div className={`text-xs font-medium leading-tight truncate px-1 ${isAtRisk ? 'text-red-700' : 'text-gray-700'}`} title={m.name}>{m.name}</div>
                          <div className="text-[10px] text-gray-400 capitalize">{m.category}</div>
                          <div className={`text-[10px] font-semibold mt-0.5 ${isAtRisk ? 'text-red-500' : 'text-emerald-600'}`}>
                            {qualified.length} gekwal.
                          </div>
                        </th>
                      )
                    })}
                    {/* Score column */}
                    <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 text-center font-semibold text-gray-600 border-b border-l border-gray-200 min-w-[60px] text-xs">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((emp, rowIdx) => {
                    const score = employeeMachineCount[emp.id] ?? 0
                    const scoreColor = score === 0 ? 'text-gray-400' : score >= 3 ? 'text-emerald-700' : 'text-blue-700'
                    return (
                      <tr key={emp.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        {/* Sticky name */}
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <Avatar employee={emp} size="sm" />
                            <span className="font-medium text-gray-900 truncate max-w-[140px]">{emp.name}</span>
                            {!emp.active && <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">inactief</span>}
                          </div>
                        </td>
                        {/* Level cells */}
                        {visibleMachines.map((m) => {
                          const level = getLevel(emp.id, m.id)
                          return (
                            <td key={m.id} className="border-r border-gray-100 p-0.5 h-9 w-[76px]">
                              <LevelCell
                                level={level}
                                onClick={() => setLevelPopup({ employeeId: emp.id, machineId: m.id })}
                                saving={saving === `${emp.id}-${m.id}`}
                              />
                            </td>
                          )
                        })}
                        {/* Score */}
                        <td className="sticky right-0 z-10 bg-inherit border-l border-gray-200 text-center px-2">
                          <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>{score}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Level picker popup */}
          {levelPopup && (() => {
            const emp = employees.find(e => e.id === levelPopup.employeeId)
            const mac = machines.find(m => m.id === levelPopup.machineId)
            const currentLevel = getLevel(levelPopup.employeeId, levelPopup.machineId)
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setLevelPopup(null)}>
                <div className="bg-white rounded-xl shadow-xl p-5 w-72" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-gray-800">Competentieniveau instellen</div>
                    <button type="button" onClick={() => setLevelPopup(null)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  {emp && mac && (
                    <div className="text-xs text-gray-500 mb-4">
                      <span className="font-medium text-gray-700">{emp.name}</span> · <span>{mac.name}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {LEVELS.map((l) => (
                      <button key={l.value} type="button" onClick={() => void handleSetLevel(l.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${l.bg} ${l.text} hover:opacity-80 ${currentLevel === l.value ? `ring-2 ${l.ring}` : ''}`}>
                        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${l.bg} ${l.text}`}>
                          {l.value === 0 ? '·' : l.label}
                        </span>
                        <span className="flex-1">{l.desc}</span>
                        {currentLevel === l.value && <Check className="w-4 h-4 opacity-60" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Machine detail popup (click column header) */}
          {machineDetailPopup && (() => {
            const allForMachine = employees.filter((e) => e.active)
            const byLevel = [4,3,2,1,0].map((lvl) => ({
              level: lvl,
              employees: allForMachine.filter((e) => getLevel(e.id, machineDetailPopup.id) === lvl),
            })).filter((g) => g.employees.length > 0)
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setMachineDetailPopup(null)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-base font-semibold text-gray-900">{machineDetailPopup.name}</div>
                      <div className="text-xs text-gray-400 capitalize mt-0.5">{machineDetailPopup.category}{machineDetailPopup.description ? ` · ${machineDetailPopup.description}` : ''}</div>
                    </div>
                    <button type="button" onClick={() => setMachineDetailPopup(null)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <div className="space-y-3">
                    {byLevel.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">Niemand gekoppeld aan deze machine</div>
                    ) : byLevel.map((g) => {
                      const l = LEVELS[g.level]
                      return (
                        <div key={g.level}>
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold mb-1.5 ${l.bg} ${l.text}`}>
                            {l.value > 0 && <span>{l.label}</span>}
                            {l.desc}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {g.employees.map((e) => (
                              <div key={e.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                <Avatar employee={e} size="sm" />
                                <span className="text-sm text-gray-700">{e.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ════════════════════ TAB: MACHINES ════════════════════ */}
      {tab === 'machines' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">{machines.filter(m => m.active).length} actief · {machines.filter(m => !m.active).length} inactief</p>
            </div>
            <button type="button" onClick={openNewMachine}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />Nieuwe machine / werkplek
            </button>
          </div>

          {machines.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Settings className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nog geen machines toegevoegd</p>
            </div>
          ) : (
            <>
              {CATEGORIES.map((cat) => {
                const catMachines = machines.filter(m => m.category === cat).sort((a,b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                if (catMachines.length === 0) return null
                return (
                  <div key={cat} className="mb-6">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 capitalize pl-1">{cat}</h2>
                    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Naam</th>
                            <th className="px-4 py-3 text-left font-semibold">Omschrijving</th>
                            <th className="px-4 py-3 text-center font-semibold">Gekwal. MDW</th>
                            <th className="px-4 py-3 text-left font-semibold">Volgorde</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Acties</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catMachines.map((m) => {
                            const qualified = machineQualified[m.id] ?? []
                            const isAtRisk = m.active && qualified.length < 2
                            return (
                              <tr key={m.id} className={`hover:bg-gray-50 ${!m.active ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                    <span className="font-medium text-gray-900">{m.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.description || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-sm font-semibold tabular-nums ${isAtRisk ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {qualified.length}
                                  </span>
                                  <span className="text-xs text-gray-400 ml-1">/ {activeEmployees.length}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 tabular-nums">{m.sort_order}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {m.active ? 'Actief' : 'Inactief'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button type="button" onClick={() => void toggleMachineActive(m)} className="text-xs text-gray-500 hover:text-gray-700 underline px-2 py-1">
                                      {m.active ? 'Deactiveer' : 'Activeer'}
                                    </button>
                                    <button type="button" onClick={() => openEditMachine(m)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Bewerken">
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => void deleteMachine(m.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Verwijderen">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Machine form modal */}
          {machineForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-gray-900">{machineForm.id ? 'Machine bewerken' : 'Nieuwe machine / werkplek'}</h2>
                  <button type="button" onClick={() => setMachineForm(null)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                    <input type="text" value={machineForm.name ?? ''} onChange={(e) => setMachineForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="bijv. Lasmachine 1, Inpakstation A" autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                    <textarea value={machineForm.description ?? ''} onChange={(e) => setMachineForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Optionele beschrijving" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                      <select value={machineForm.category ?? 'machine'} onChange={(e) => setMachineForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Volgorde</label>
                      <input type="number" value={machineForm.sort_order ?? 0} onChange={(e) => setMachineForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  {machineError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />{machineError}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setMachineForm(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuleren</button>
                  <button type="button" onClick={() => void saveMachine()} disabled={savingMachine}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {savingMachine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ TAB: DAGPLANNING ════════════════════ */}
      {tab === 'dagplanning' && (
        <div>
          {/* Date navigation */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => shiftDate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium" />
            </div>
            <button type="button" onClick={() => shiftDate(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
            {([-1,0,1] as const).map((offset) => {
              const d = new Date(); d.setDate(d.getDate() + offset)
              const val = toDateInput(d)
              const labels = ['Gisteren','Vandaag','Morgen']
              return (
                <button key={offset} type="button" onClick={() => setSelectedDate(val)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${selectedDate === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {labels[offset + 1]}
                </button>
              )
            })}
            <button type="button" onClick={() => void handleCopyYesterday()} disabled={copyingYesterday}
              className="inline-flex items-center gap-2 ml-auto px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              {copyingYesterday
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Copy className="w-4 h-4" />}
              {copyingYesterday ? 'Bezig...' : 'Kopieer van gisteren'}
            </button>
            {loadingPlanning && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>

          {/* Summary */}
          <div className="mb-5 flex flex-wrap gap-3">
            {STATUSES.map((s) => {
              const count = visibleEmployees.filter((e) => { const ds = getDailyStatus(e.id); return ds?.status === s.value }).length
              if (count === 0) return null
              return (
                <div key={s.value} className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${s.color}`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {count}× {s.label}
                </div>
              )
            })}
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-4 py-1.5 text-sm text-gray-500">
              {visibleEmployees.filter((e) => !getDailyStatus(e.id)).length} niet ingevuld
            </div>
          </div>

          {/* Split layout: employees left, machine overview right */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Employee cards */}
            <div className="xl:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleEmployees.map((emp) => {
                  const ds = getDailyStatus(emp.id)
                  const status = ds?.status ?? ''
                  const assignedMachineId = ds?.assigned_machine_id ?? null
                  const isSaving = saving === `status-${emp.id}`
                  const isPresent = !status || status === 'aanwezig' || status === 'thuiswerk'
                  const statusObj = STATUSES.find(s => s.value === status)
                  const borderColor = !ds ? 'border-gray-200' : status === 'aanwezig' ? 'border-emerald-300' : status === 'thuiswerk' ? 'border-purple-300' : status === 'verlof' ? 'border-blue-300' : status === 'ziek' ? 'border-orange-300' : 'border-red-300'

                  return (
                    <div key={emp.id} className={`bg-white rounded-xl border-2 shadow-sm p-4 transition-all ${borderColor}`}>
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar employee={emp} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{emp.name}</div>
                          {ds ? <StatusBadge status={status} /> : <span className="text-xs text-gray-400">Niet ingevuld</span>}
                        </div>
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
                      </div>

                      {/* Status buttons */}
                      <div className="grid grid-cols-3 gap-1 mb-3">
                        {STATUSES.map((s) => (
                          <button key={s.value} type="button" disabled={isSaving}
                            onClick={() => void handleStatusChange(emp.id, s.value)}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${status === s.value && ds ? `${s.color} shadow-sm` : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {/* Machine assignment */}
                      {isPresent && (
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Toewijzen aan</label>
                          <select value={assignedMachineId ?? ''} disabled={isSaving}
                            onChange={(e) => handleMachineAssign(emp.id, e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500">
                            <option value="">— Niet toegewezen —</option>
                            {machines.filter(m => m.active).map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {getLevel(emp.id, m.id) >= 2 ? '✓' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Competency tags */}
                      {isPresent && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {machines.filter(m => m.active && getLevel(emp.id, m.id) >= 2).map(m => {
                            const lvl = LEVELS[getLevel(emp.id, m.id)]
                            return (
                              <span key={m.id} title={`${m.name}: ${lvl.desc}`}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${lvl.bg} ${lvl.text}`}>
                                {m.name}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Machine overview sidebar */}
            <div className="xl:col-span-1">
              <div className="sticky top-6">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Machineoverzicht</h2>
                <div className="space-y-2">
                  {machines.filter(m => m.active).map(m => {
                    const assigned = visibleEmployees.filter(e => {
                      const ds = getDailyStatus(e.id)
                      return ds?.assigned_machine_id === m.id && (ds.status === 'aanwezig' || ds.status === 'thuiswerk')
                    })
                    const qualified = machineQualified[m.id] ?? []
                    const available = visibleEmployees.filter(e => getLevel(e.id, m.id) >= 2 && (getDailyStatus(e.id)?.status === 'aanwezig' || !getDailyStatus(e.id)))
                    return (
                      <div key={m.id} className={`rounded-xl border p-3 transition-all ${assigned.length > 0 ? 'border-emerald-200 bg-emerald-50' : qualified.length < 2 ? 'border-red-100 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-gray-700 truncate">{m.name}</div>
                          {qualified.length < 2 && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                        </div>
                        {assigned.length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Niemand toegewezen</div>
                        ) : (
                          <div className="space-y-0.5">
                            {assigned.map(e => (
                              <div key={e.id} className="flex items-center gap-1.5">
                                <Avatar employee={e} size="sm" />
                                <span className="text-xs font-medium text-emerald-800">{e.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5 text-[10px] text-gray-400">
                          {available.length} aanwezig gekwalificeerd · {qualified.length} totaal
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
