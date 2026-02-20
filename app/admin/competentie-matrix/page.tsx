'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  LayoutGrid,
  Settings,
  CalendarDays,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: number
  name: string
  active: boolean
}

interface Machine {
  id: number
  name: string
  description: string | null
  category: string
  active: boolean
  sort_order: number
}

interface Competency {
  id: number
  employee_id: number
  machine_id: number
  level: number
  notes: string | null
}

interface DailyStatus {
  id: number
  employee_id: number
  date: string
  status: string
  assigned_machine_id: number | null
  notes: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVELS = [
  { value: 0, label: '—', desc: 'Geen kennis', color: 'bg-gray-100 text-gray-400', dot: 'bg-gray-200' },
  { value: 1, label: '●', desc: 'In opleiding', color: 'bg-yellow-50 text-yellow-600', dot: 'bg-yellow-400' },
  { value: 2, label: '●●', desc: 'Basiskennis', color: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400' },
  { value: 3, label: '●●●', desc: 'Gevorderd', color: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  { value: 4, label: '●●●●', desc: 'Expert', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
]

const STATUSES = [
  { value: 'aanwezig',  label: 'Aanwezig',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'afwezig',   label: 'Afwezig',    color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'verlof',    label: 'Verlof',     color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'ziek',      label: 'Ziek',       color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'thuiswerk', label: 'Thuiswerk',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
]

const CATEGORIES = ['machine', 'werkplek', 'overig']

const toDateInput = (d: Date) => d.toISOString().split('T')[0]

// ─── Helper components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status) ?? STATUSES[0]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

function LevelBadge({ level, onClick }: { level: number; onClick?: () => void }) {
  const l = LEVELS[level] ?? LEVELS[0]
  return (
    <button
      type="button"
      onClick={onClick}
      title={l.desc}
      className={`w-full h-full flex items-center justify-center text-xs font-bold rounded transition-all ${l.color} ${onClick ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
    >
      {level === 0 ? <span className="text-gray-300 text-base">—</span> : <span className="tracking-widest">{l.label}</span>}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompetentieMatrixPage() {
  const [tab, setTab] = useState<'matrix' | 'machines' | 'dagplanning'>('matrix')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [dailyStatuses, setDailyStatuses] = useState<DailyStatus[]>([])
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()))
  const [loadingMatrix, setLoadingMatrix] = useState(true)
  const [loadingPlanning, setLoadingPlanning] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  // Machine form
  const [machineForm, setMachineForm] = useState<Partial<Machine> | null>(null)
  const [machineError, setMachineError] = useState('')
  const [savingMachine, setSavingMachine] = useState(false)

  // Level picker popup
  const [levelPopup, setLevelPopup] = useState<{ employeeId: number; machineId: number } | null>(null)

  // Filter
  const [showInactive, setShowInactive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBase = useCallback(async () => {
    setLoadingMatrix(true)
    try {
      const [empRes, machRes, compRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/machines'),
        fetch('/api/competencies'),
      ])
      if (empRes.ok) setEmployees(await empRes.json())
      if (machRes.ok) setMachines(await machRes.json())
      if (compRes.ok) setCompetencies(await compRes.json())
    } finally {
      setLoadingMatrix(false)
    }
  }, [])

  const fetchPlanning = useCallback(async (date: string) => {
    setLoadingPlanning(true)
    try {
      const res = await fetch(`/api/dagplanning?date=${date}`)
      if (res.ok) setDailyStatuses(await res.json())
    } finally {
      setLoadingPlanning(false)
    }
  }, [])

  useEffect(() => { void fetchBase() }, [fetchBase])
  useEffect(() => { void fetchPlanning(selectedDate) }, [fetchPlanning, selectedDate])

  // ── Derived data ───────────────────────────────────────────────────────────

  const visibleEmployees = employees.filter((e) => showInactive || e.active)
  const visibleMachines = machines.filter(
    (m) => m.active && (categoryFilter === 'all' || m.category === categoryFilter)
  )

  const getLevel = (employeeId: number, machineId: number) =>
    competencies.find((c) => c.employee_id === employeeId && c.machine_id === machineId)?.level ?? 0

  const getDailyStatus = (employeeId: number) =>
    dailyStatuses.find((s) => s.employee_id === employeeId)

  // ── Competency actions ─────────────────────────────────────────────────────

  const handleLevelClick = (employeeId: number, machineId: number) => {
    setLevelPopup({ employeeId, machineId })
  }

  const handleSetLevel = async (level: number) => {
    if (!levelPopup) return
    const { employeeId, machineId } = levelPopup
    setSaving(`${employeeId}-${machineId}`)
    setLevelPopup(null)
    try {
      const res = await fetch('/api/competencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, machine_id: machineId, level }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCompetencies((prev) => {
          const exists = prev.findIndex(
            (c) => c.employee_id === employeeId && c.machine_id === machineId
          )
          if (exists >= 0) {
            const next = [...prev]
            next[exists] = updated
            return next
          }
          return [...prev, updated]
        })
      }
    } finally {
      setSaving(null)
    }
  }

  // ── Daily status actions ───────────────────────────────────────────────────

  const handleStatusChange = async (
    employeeId: number,
    status: string,
    assignedMachineId?: number | null
  ) => {
    const key = `status-${employeeId}`
    setSaving(key)
    try {
      const current = getDailyStatus(employeeId)
      const res = await fetch('/api/dagplanning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          date: selectedDate,
          status,
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
    } finally {
      setSaving(null)
    }
  }

  const handleMachineAssign = async (employeeId: number, machineId: number | null) => {
    const current = getDailyStatus(employeeId)
    const status = current?.status ?? 'aanwezig'
    await handleStatusChange(employeeId, status, machineId)
  }

  // ── Machine CRUD ───────────────────────────────────────────────────────────

  const openNewMachine = () => {
    setMachineForm({ name: '', description: '', category: 'machine', active: true, sort_order: 0 })
    setMachineError('')
  }

  const openEditMachine = (m: Machine) => {
    setMachineForm({ ...m })
    setMachineError('')
  }

  const saveMachine = async () => {
    if (!machineForm) return
    if (!machineForm.name?.trim()) { setMachineError('Naam is verplicht'); return }
    setSavingMachine(true)
    setMachineError('')
    try {
      const isNew = !machineForm.id
      const res = await fetch('/api/machines', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machineForm),
      })
      if (!res.ok) {
        const e = await res.json()
        setMachineError(e.error ?? 'Fout bij opslaan')
        return
      }
      const saved = await res.json()
      setMachines((prev) =>
        isNew ? [...prev, saved] : prev.map((m) => (m.id === saved.id ? saved : m))
      )
      setMachineForm(null)
    } finally {
      setSavingMachine(false)
    }
  }

  const deleteMachine = async (id: number) => {
    if (!confirm('Machine verwijderen? Dit verwijdert ook alle gekoppelde competenties.')) return
    const res = await fetch(`/api/machines?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMachines((prev) => prev.filter((m) => m.id !== id))
      setCompetencies((prev) => prev.filter((c) => c.machine_id !== id))
    }
  }

  const toggleMachineActive = async (m: Machine) => {
    const res = await fetch('/api/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, active: !m.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMachines((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    }
  }

  // ── Dagplanning summary ────────────────────────────────────────────────────

  const presentEmployees = visibleEmployees.filter((e) => {
    const s = getDailyStatus(e.id)
    return !s || s.status === 'aanwezig' || s.status === 'thuiswerk'
  })
  const absentEmployees = visibleEmployees.filter((e) => {
    const s = getDailyStatus(e.id)
    return s && (s.status === 'afwezig' || s.status === 'verlof' || s.status === 'ziek')
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px]">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-3">
          ← Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Competentie Matrix</h1>
        <p className="mt-1 text-gray-500 text-sm">Beheer competenties, machines en dagplanning van medewerkers</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {(
            [
              { id: 'matrix', label: 'Competentie Matrix', icon: <LayoutGrid className="w-4 h-4" /> },
              { id: 'machines', label: 'Machines & Werkplekken', icon: <Settings className="w-4 h-4" /> },
              { id: 'dagplanning', label: 'Dagplanning', icon: <CalendarDays className="w-4 h-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── TAB: MATRIX ─────────────────────────────────────────────────────── */}
      {tab === 'matrix' && (
        <div>
          {/* Controls */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 ${categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Alles
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`px-3 py-1.5 border-l border-gray-200 capitalize ${categoryFilter === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              Toon inactieve medewerkers
            </label>
            {/* Legend */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {LEVELS.map((l) => (
                <span key={l.value} className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <span className={`w-3 h-3 rounded-full ${l.dot}`} />
                  {l.desc}
                </span>
              ))}
            </div>
          </div>

          {loadingMatrix ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Laden...
            </div>
          ) : visibleMachines.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">Geen machines gevonden</p>
              <button type="button" onClick={() => setTab('machines')} className="text-sm text-blue-600 hover:underline">
                Voeg een machine of werkplek toe →
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-auto shadow-sm">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {/* Sticky employee column header */}
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[180px]">
                      Medewerker
                    </th>
                    {visibleMachines.map((m) => (
                      <th
                        key={m.id}
                        className="px-2 py-2 text-center font-medium text-gray-600 border-b border-r border-gray-100 min-w-[90px] max-w-[120px] bg-gray-50"
                      >
                        <div className="truncate text-xs leading-tight" title={m.name}>{m.name}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{m.category}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((emp, rowIdx) => (
                    <tr key={emp.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {/* Sticky name column */}
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-gray-900 border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                          <span>{emp.name}</span>
                          {!emp.active && (
                            <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">inactief</span>
                          )}
                        </div>
                      </td>
                      {visibleMachines.map((m) => {
                        const level = getLevel(emp.id, m.id)
                        const isSaving = saving === `${emp.id}-${m.id}`
                        return (
                          <td key={m.id} className="border-r border-gray-100 p-1 h-10">
                            {isSaving ? (
                              <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              </div>
                            ) : (
                              <LevelBadge
                                level={level}
                                onClick={() => handleLevelClick(emp.id, m.id)}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Level picker popup */}
          {levelPopup && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
              onClick={() => setLevelPopup(null)}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 w-64"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-800">Niveau instellen</div>
                  <button type="button" onClick={() => setLevelPopup(null)}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => void handleSetLevel(l.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left ${l.color} hover:opacity-80 transition-opacity`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                      <span className="flex-1">{l.desc}</span>
                      <span className="text-xs opacity-60">{l.label === '—' ? '' : l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MACHINES ───────────────────────────────────────────────────── */}
      {tab === 'machines' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{machines.length} machine(s) / werkplek(ken)</p>
            <button
              type="button"
              onClick={openNewMachine}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nieuwe machine / werkplek
            </button>
          </div>

          {machines.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Settings className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nog geen machines toegevoegd</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Naam</th>
                    <th className="px-4 py-3 text-left font-semibold">Omschrijving</th>
                    <th className="px-4 py-3 text-left font-semibold">Categorie</th>
                    <th className="px-4 py-3 text-left font-semibold">Volgorde</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {machines
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map((m) => (
                      <tr key={m.id} className={`hover:bg-gray-50 ${!m.active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.description || '—'}</td>
                        <td className="px-4 py-3 capitalize">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                            {m.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{m.sort_order}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              m.active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {m.active ? 'Actief' : 'Inactief'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleMachineActive(m)}
                              className="text-xs text-gray-500 hover:text-gray-700 underline"
                            >
                              {m.active ? 'Deactiveer' : 'Activeer'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditMachine(m)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                              title="Bewerken"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteMachine(m.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Machine form modal */}
          {machineForm !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {machineForm.id ? 'Machine bewerken' : 'Nieuwe machine / werkplek'}
                  </h2>
                  <button type="button" onClick={() => setMachineForm(null)}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                    <input
                      type="text"
                      value={machineForm.name ?? ''}
                      onChange={(e) => setMachineForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="bijv. Lasmachine 1, Inpakstation A"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                    <textarea
                      value={machineForm.description ?? ''}
                      onChange={(e) => setMachineForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Optionele beschrijving"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                      <select
                        value={machineForm.category ?? 'machine'}
                        onChange={(e) => setMachineForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c} className="capitalize">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Volgorde</label>
                      <input
                        type="number"
                        value={machineForm.sort_order ?? 0}
                        onChange={(e) => setMachineForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {machineError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {machineError}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setMachineForm(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveMachine()}
                    disabled={savingMachine}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingMachine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DAGPLANNING ────────────────────────────────────────────────── */}
      {tab === 'dagplanning' && (
        <div>
          {/* Date picker */}
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-5">
              {[-1, 0, 1].map((offset) => {
                const d = new Date()
                d.setDate(d.getDate() + offset)
                const val = toDateInput(d)
                const labels = ['Gisteren', 'Vandaag', 'Morgen']
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setSelectedDate(val)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedDate === val
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {labels[offset + 1]}
                  </button>
                )
              })}
            </div>
            {loadingPlanning && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-5" />
            )}
          </div>

          {/* Summary chips */}
          <div className="mb-5 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {presentEmployees.length} aanwezig
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {absentEmployees.length} afwezig/verlof/ziek
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-4 py-1.5 text-sm text-gray-500">
              {visibleEmployees.length - presentEmployees.length - absentEmployees.length} niet ingevuld
            </div>
          </div>

          {/* Employee grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleEmployees.map((emp) => {
              const ds = getDailyStatus(emp.id)
              const status = ds?.status ?? 'aanwezig'
              const assignedMachineId = ds?.assigned_machine_id ?? null
              const isSavingThis = saving === `status-${emp.id}`
              const isPresent = !ds || status === 'aanwezig' || status === 'thuiswerk'

              return (
                <div
                  key={emp.id}
                  className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                    !ds ? 'border-gray-200' : status === 'aanwezig' ? 'border-emerald-200' : status === 'thuiswerk' ? 'border-purple-200' : 'border-red-200'
                  }`}
                >
                  {/* Employee header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center shrink-0 ${
                      !ds ? 'bg-gray-100 text-gray-500' : status === 'aanwezig' ? 'bg-emerald-100 text-emerald-700' : status === 'thuiswerk' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {emp.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{emp.name}</div>
                      {ds ? <StatusBadge status={status} /> : (
                        <span className="text-xs text-gray-400">Niet ingevuld</span>
                      )}
                    </div>
                    {isSavingThis && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>

                  {/* Status selector */}
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => void handleStatusChange(emp.id, s.value)}
                        disabled={isSavingThis}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          status === s.value && ds
                            ? s.color + ' ring-2 ring-offset-1 ring-current/30'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Machine assignment — only when present */}
                  {isPresent && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Toewijzen aan</label>
                      <select
                        value={assignedMachineId ?? ''}
                        onChange={(e) =>
                          void handleMachineAssign(emp.id, e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={isSavingThis}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Nog niet toegewezen —</option>
                        {machines
                          .filter((m) => m.active)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Competencies quick overview */}
                  {isPresent && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {machines
                        .filter((m) => m.active && getLevel(emp.id, m.id) >= 2)
                        .map((m) => {
                          const lvl = getLevel(emp.id, m.id)
                          const l = LEVELS[lvl]
                          return (
                            <span
                              key={m.id}
                              title={`${m.name}: ${l.desc}`}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${l.color}`}
                            >
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

          {/* Machine overview for the day */}
          {presentEmployees.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Machineoverzicht — {selectedDate}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {machines
                  .filter((m) => m.active)
                  .map((m) => {
                    const assigned = visibleEmployees.filter((e) => {
                      const ds = getDailyStatus(e.id)
                      return ds?.assigned_machine_id === m.id && (ds.status === 'aanwezig' || ds.status === 'thuiswerk')
                    })
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-3 ${assigned.length > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">{m.name}</div>
                        {assigned.length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Niemand</div>
                        ) : (
                          <div className="space-y-1">
                            {assigned.map((e) => (
                              <div key={e.id} className="text-sm font-medium text-emerald-800 truncate">{e.name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
