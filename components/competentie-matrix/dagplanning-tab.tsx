'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  LayoutList,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Avatar, StatusBadge } from '@/components/competentie-matrix/primitives'
import {
  formatPlanningDate,
  isPresentStatus,
  LEVELS,
  SHIFTS,
  STATUSES,
  toDateInput,
} from '@/lib/competentie-matrix/constants'

interface Employee { id: number; name: string; active: boolean }
interface Machine { id: number; name: string; active: boolean; capacity: number }
interface DailyStatus {
  id: number
  employee_id: number
  date: string
  status: string
  shift: string
  assigned_machine_id: number | null
  notes: string | null
}

type PlanningFilter = 'all' | 'aanwezig' | 'afwezig' | 'open'
type PlanningLayout = 'board' | 'compact'

export interface ProtimePreviewData {
  generatedAt: string | null
  preview: Array<{
    employee_id: number | null
    employee_name: string
    protime_name: string
    date: string
    status: string
    raw: string
    matched: boolean
  }>
  unmatched: string[]
  stats: { total: number; matched: number; unmatched: number }
  warnings: string[]
}

export interface DagplanningTabProps {
  selectedDate: string
  onDateChange: (date: string) => void
  onShiftDate: (days: number) => void
  loadingPlanning: boolean
  visibleEmployees: Employee[]
  machines: Machine[]
  getDailyStatus: (employeeId: number) => DailyStatus | undefined
  getLevel: (employeeId: number, machineId: number) => number
  machineQualified: Record<number, Employee[]>
  saving: string | null
  onStatusChange: (employeeId: number, status: string) => void
  onShiftChange: (employeeId: number, shift: string) => void
  onMachineAssign: (employeeId: number, machineId: number | null) => void
  onDragStart: (employeeId: number) => void
  onDropOnMachine: (machineId: number) => void
  onAutoSuggest: () => void
  onCopyYesterday: () => void
  copyingYesterday: boolean
  employeeSearch: string
  onEmployeeSearchChange: (value: string) => void
  protimeInputRef: React.RefObject<HTMLInputElement | null>
  protimeImporting: boolean
  protimeApplying: boolean
  protimePreview: ProtimePreviewData | null
  onProtimeFile: (file: File) => void
  onApplyProtime: () => void
  onCancelProtime: () => void
}

function statusBorder(status: string, hasEntry: boolean): string {
  if (!hasEntry) return 'border-l-slate-300'
  const s = STATUSES.find((x) => x.value === status)
  return s?.border ?? 'border-l-slate-300'
}

function EmployeeCard({
  emp,
  ds,
  machines,
  getLevel,
  isSaving,
  onStatusChange,
  onShiftChange,
  onMachineAssign,
  onDragStart,
  compact,
}: {
  emp: Employee
  ds: DailyStatus | undefined
  machines: Machine[]
  getLevel: (employeeId: number, machineId: number) => number
  isSaving: boolean
  onStatusChange: (status: string) => void
  onShiftChange: (shift: string) => void
  onMachineAssign: (machineId: number | null) => void
  onDragStart: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(!compact)
  const status = ds?.status ?? ''
  const shift = ds?.shift ?? 'dag'
  const assignedMachineId = ds?.assigned_machine_id ?? null
  const present = isPresentStatus(status)
  const shiftObj = SHIFTS.find((s) => s.value === shift) ?? SHIFTS[0]
  const assignedMachine = machines.find((m) => m.id === assignedMachineId)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`group rounded-xl border border-gray-200/80 bg-white shadow-sm transition-shadow hover:shadow-md border-l-4 ${statusBorder(status, !!ds)}`}
    >
      <div className="flex items-center gap-2.5 p-3">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 opacity-0 group-hover:opacity-100 cursor-grab" />
        <Avatar employee={emp} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{emp.name}</span>
            {ds ? <StatusBadge status={status} /> : (
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Open</span>
            )}
          </div>
          {present && assignedMachine && (
            <p className="text-xs text-emerald-700 mt-0.5 truncate">→ {assignedMachine.name}</p>
          )}
        </div>
        <span className={`hidden sm:inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${shiftObj.color}`}>
          {shiftObj.label}
        </span>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-300 shrink-0" />}
        {compact && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
            aria-expanded={open}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className={`px-3 pb-3 ${compact && !open ? 'hidden' : ''}`}>
        <div className="flex flex-wrap gap-1 mb-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={isSaving}
              onClick={() => onStatusChange(s.value)}
              title={s.label}
              className={`min-w-[2.4rem] flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                status === s.value && ds
                  ? `${s.color} ring-1 ${s.ring}`
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s.short}
            </button>
          ))}
        </div>

        {present && (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <div className="flex flex-wrap gap-1 pt-2">
              {SHIFTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={isSaving}
                  onClick={() => onShiftChange(s.value)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                    shift === s.value && ds ? `${s.color} ring-1` : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <select
              value={assignedMachineId ?? ''}
              disabled={isSaving}
              onChange={(e) => onMachineAssign(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Machine toewijzen…</option>
              {machines.filter((m) => m.active).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{getLevel(emp.id, m.id) >= 2 ? ' ✓' : ''}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {machines.filter((m) => m.active && getLevel(emp.id, m.id) >= 2).slice(0, 6).map((m) => {
                const lvl = LEVELS[getLevel(emp.id, m.id)]
                return (
                  <span
                    key={m.id}
                    title={`${m.name}: ${lvl.desc}`}
                    className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${lvl.bg} ${lvl.text}`}
                  >
                    {m.name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DagplanningTab({
  selectedDate,
  onDateChange,
  onShiftDate,
  loadingPlanning,
  visibleEmployees,
  machines,
  getDailyStatus,
  getLevel,
  machineQualified,
  saving,
  onStatusChange,
  onShiftChange,
  onMachineAssign,
  onDragStart,
  onDropOnMachine,
  onAutoSuggest,
  onCopyYesterday,
  copyingYesterday,
  employeeSearch,
  onEmployeeSearchChange,
  protimeInputRef,
  protimeImporting,
  protimeApplying,
  protimePreview,
  onProtimeFile,
  onApplyProtime,
  onCancelProtime,
}: DagplanningTabProps) {
  const [filter, setFilter] = useState<PlanningFilter>('all')
  const [layout, setLayout] = useState<PlanningLayout>('board')

  const activeMachines = machines.filter((m) => m.active)

  const stats = useMemo(() => {
    let aanwezig = 0
    let afwezig = 0
    let open = 0
    let assigned = 0
    for (const e of visibleEmployees) {
      const ds = getDailyStatus(e.id)
      if (!ds) { open++; continue }
      if (isPresentStatus(ds.status)) {
        aanwezig++
        if (ds.assigned_machine_id) assigned++
      } else {
        afwezig++
      }
    }
    const machinesFilled = activeMachines.filter((m) =>
      visibleEmployees.some((e) => {
        const ds = getDailyStatus(e.id)
        return ds?.assigned_machine_id === m.id && isPresentStatus(ds.status)
      }),
    ).length
    return { aanwezig, afwezig, open, assigned, machinesFilled, machinesTotal: activeMachines.length }
  }, [visibleEmployees, getDailyStatus, activeMachines])

  const groups = useMemo(() => {
    const present: Employee[] = []
    const absent: Employee[] = []
    const open: Employee[] = []
    for (const e of visibleEmployees) {
      const ds = getDailyStatus(e.id)
      if (!ds) open.push(e)
      else if (isPresentStatus(ds.status)) present.push(e)
      else absent.push(e)
    }
    return { present, absent, open }
  }, [visibleEmployees, getDailyStatus])

  const filteredGroups = useMemo(() => {
    const match = (list: Employee[]) => list
    switch (filter) {
      case 'aanwezig': return { present: match(groups.present), absent: [], open: [] }
      case 'afwezig': return { present: [], absent: match(groups.absent), open: [] }
      case 'open': return { present: [], absent: [], open: match(groups.open) }
      default: return groups
    }
  }, [filter, groups])

  const todayStr = toDateInput(new Date())
  const isToday = selectedDate === todayStr

  const renderEmployeeList = (list: Employee[]) => (
    <div className={layout === 'compact' ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'}>
      {list.map((emp) => (
        <EmployeeCard
          key={emp.id}
          emp={emp}
          ds={getDailyStatus(emp.id)}
          machines={machines}
          getLevel={getLevel}
          isSaving={saving === `status-${emp.id}`}
          onStatusChange={(status) => onStatusChange(emp.id, status)}
          onShiftChange={(shift) => onShiftChange(emp.id, shift)}
          onMachineAssign={(machineId) => onMachineAssign(emp.id, machineId)}
          onDragStart={() => onDragStart(emp.id)}
          compact={layout === 'compact'}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onShiftDate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-white text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => onShiftDate(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-white text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Planning</p>
            <p className="text-lg font-bold text-gray-900 capitalize leading-tight">{formatPlanningDate(selectedDate)}</p>
            {isToday && <span className="text-[10px] font-semibold text-blue-600 uppercase">Vandaag</span>}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          {([-1, 0, 1] as const).map((offset) => {
            const d = new Date()
            d.setDate(d.getDate() + offset)
            const val = toDateInput(d)
            const labels = ['Gisteren', 'Vandaag', 'Morgen']
            return (
              <button
                key={offset}
                type="button"
                onClick={() => onDateChange(val)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  selectedDate === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {labels[offset + 1]}
              </button>
            )
          })}
          {loadingPlanning && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50/80">
          <input
            ref={protimeInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onProtimeFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => protimeInputRef.current?.click()}
            disabled={protimeImporting}
            className="inline-flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-white rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {protimeImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Protime PDF
          </button>
          <button
            type="button"
            onClick={onAutoSuggest}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-bezetting
          </button>
          <button
            type="button"
            onClick={onCopyYesterday}
            disabled={copyingYesterday}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {copyingYesterday ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Kopieer gisteren
          </button>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setLayout('board')}
              className={`p-1.5 rounded-md ${layout === 'board' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
              title="Kaarten"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayout('compact')}
              className={`p-1.5 rounded-md ${layout === 'compact' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
              title="Compact"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFilter(filter === 'aanwezig' ? 'all' : 'aanwezig')}
          className={`rounded-xl border p-3 text-left transition-all ${filter === 'aanwezig' ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 bg-white hover:border-emerald-200'}`}
        >
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.aanwezig}</p>
          <p className="text-xs text-gray-500">Aanwezig</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'afwezig' ? 'all' : 'afwezig')}
          className={`rounded-xl border p-3 text-left transition-all ${filter === 'afwezig' ? 'border-red-300 bg-red-50 ring-2 ring-red-200' : 'border-gray-200 bg-white hover:border-red-200'}`}
        >
          <p className="text-2xl font-bold text-red-700 tabular-nums">{stats.afwezig}</p>
          <p className="text-xs text-gray-500">Afwezig</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
          className={`rounded-xl border p-3 text-left transition-all ${filter === 'open' ? 'border-slate-300 bg-slate-50 ring-2 ring-slate-200' : 'border-gray-200 bg-white hover:border-slate-300'}`}
        >
          <p className="text-2xl font-bold text-slate-700 tabular-nums">{stats.open}</p>
          <p className="text-xs text-gray-500">Nog open</p>
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-2xl font-bold text-blue-700 tabular-nums">{stats.assigned}</p>
          <p className="text-xs text-gray-500">Toegewezen</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 col-span-2 lg:col-span-1">
          <p className="text-2xl font-bold text-indigo-700 tabular-nums">{stats.machinesFilled}/{stats.machinesTotal}</p>
          <p className="text-xs text-gray-500">Machines bezet</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Zoek medewerker…"
          value={employeeSearch}
          onChange={(e) => onEmployeeSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Protime preview */}
      {protimePreview && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-indigo-900">Protime-import</h3>
              <p className="text-sm text-indigo-700 mt-0.5">
                {protimePreview.stats.matched} gekoppeld · {protimePreview.stats.unmatched} onbekend
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCancelProtime} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
                Annuleren
              </button>
              <button
                type="button"
                onClick={onApplyProtime}
                disabled={protimeApplying || protimePreview.stats.matched === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {protimeApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Toepassen
              </button>
            </div>
          </div>
          {protimePreview.unmatched.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-2">
              Niet gekoppeld: {protimePreview.unmatched.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {filteredGroups.present.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Aanwezig ({filteredGroups.present.length})
              </h2>
              {renderEmployeeList(filteredGroups.present)}
            </section>
          )}

          {filteredGroups.absent.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Afwezig ({filteredGroups.absent.length})
              </h2>
              {renderEmployeeList(filteredGroups.absent)}
            </section>
          )}

          {filteredGroups.open.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Nog in te vullen ({filteredGroups.open.length})
              </h2>
              {renderEmployeeList(filteredGroups.open)}
            </section>
          )}

          {filteredGroups.present.length === 0 && filteredGroups.absent.length === 0 && filteredGroups.open.length === 0 && (
            <div className="text-center py-12 text-gray-400 rounded-xl border border-dashed border-gray-200">
              Geen medewerkers voor dit filter.
            </div>
          )}
        </div>

        {/* Machines */}
        <aside className="xl:col-span-1">
          <div className="sticky top-4 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Machines</h2>
              <p className="text-xs text-gray-500 mt-0.5">Sleep een medewerker naar een machine</p>
            </div>
            <div className="p-3 space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {activeMachines.map((m) => {
                const cap = m.capacity ?? 1
                const assigned = visibleEmployees.filter((e) => {
                  const ds = getDailyStatus(e.id)
                  return ds?.assigned_machine_id === m.id && isPresentStatus(ds.status)
                })
                const qualified = machineQualified[m.id] ?? []
                const pct = Math.min(100, (assigned.length / cap) * 100)
                const isOver = assigned.length > cap
                const isFull = assigned.length >= cap
                const isAtRisk = qualified.length < 2

                return (
                  <div
                    key={m.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropOnMachine(m.id)}
                    className={`rounded-xl border-2 p-3 transition-colors ${
                      isOver
                        ? 'border-amber-300 bg-amber-50'
                        : isFull
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : assigned.length > 0
                            ? 'border-blue-200 bg-blue-50/30'
                            : isAtRisk
                              ? 'border-red-200 bg-red-50/40'
                              : 'border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-800 truncate">{m.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                          isOver ? 'bg-amber-200 text-amber-800' : isFull ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {assigned.length}/{cap}
                        </span>
                        {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-amber-500' : isFull ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {assigned.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Leeg — sleep iemand hierheen</p>
                    ) : (
                      <div className="space-y-1">
                        {assigned.map((e) => (
                          <div key={e.id} className="flex items-center gap-1.5">
                            <Avatar employee={e} size="sm" />
                            <span className="text-xs font-medium text-gray-800">{e.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
