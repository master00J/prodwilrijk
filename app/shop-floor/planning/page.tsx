'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE, SITES, type Site } from '@/lib/sites'
import { useAuth } from '@/components/AuthProvider'

const STEPS = ['Zagen', 'Hout Halen', 'Assemblage', 'Schuren', 'Afwerking']
const SHIFTS = ['dag', 'vroeg', 'laat', 'nacht'] as const

interface Machine {
  id: number
  name: string
  capacity?: number | null
  active?: boolean
  site?: string | null
}

interface Employee {
  id: number
  name: string
  active?: boolean
  sites?: string[] | null
}

interface CandidateLine {
  id: number
  itemNumber: string
  description: string
  requiredQty: number
  completedQty: number
  remainingQty: number
}

interface CandidateOrder {
  orderNumber: string
  salesOrderNumber: string | null
  lines: CandidateLine[]
}

interface PlanningItem {
  id: number
  production_order_line_id: number | null
  order_number: string
  sales_order_number: string | null
  item_number: string | null
  description: string | null
  production_step: string
  site?: string | null
  planned_date: string
  shift: string
  machine_id: number | null
  planned_quantity: number | null
  planned_minutes: number | null
  status: 'planned' | 'released' | 'in_progress' | 'done' | 'cancelled'
  notes: string | null
  machine?: Machine | null
  employees?: Array<{ id: number; name: string }>
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateInput: string, days: number): string {
  const date = new Date(`${dateInput}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekRange(dateInput: string): { from: string; to: string } {
  const date = new Date(`${dateInput}T00:00:00`)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  const from = date.toISOString().slice(0, 10)
  const to = addDays(from, 6)
  return { from, to }
}

export default function ShopFloorPlanningPage() {
  const { allowedSites } = useAuth()
  const availableSites = useMemo(
    () => allowedSites.length > 0 ? SITES.filter(siteOption => allowedSites.includes(siteOption)) : [...SITES],
    [allowedSites]
  )
  const [site, setSite] = useState<Site>(DEFAULT_SITE)
  const [date, setDate] = useState(todayInput())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [orders, setOrders] = useState<CandidateOrder[]>([])
  const [planning, setPlanning] = useState<PlanningItem[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedLineId, setSelectedLineId] = useState('')
  const [step, setStep] = useState(STEPS[0])
  const [shift, setShift] = useState<(typeof SHIFTS)[number]>('dag')
  const [machineId, setMachineId] = useState('')
  const [employeeIds, setEmployeeIds] = useState<number[]>([])
  const [quantity, setQuantity] = useState('')
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const range = viewMode === 'week' ? weekRange(date) : { from: date, to: date }
      const planningParams = new URLSearchParams({
        date_from: range.from,
        date_to: range.to,
        site,
      })

      const [ordersRes, planningRes, machinesRes, employeesRes] = await Promise.all([
        fetch(`/api/shop-floor/production-orders?site=${encodeURIComponent(site)}`, { cache: 'no-store' }),
        fetch(`/api/shop-floor/planning?${planningParams.toString()}`, { cache: 'no-store' }),
        fetch('/api/machines'),
        fetch('/api/employees'),
      ])

      const [ordersJson, planningJson, machinesJson, employeesJson] = await Promise.all([
        ordersRes.json(),
        planningRes.json(),
        machinesRes.json(),
        employeesRes.json(),
      ])

      if (!ordersRes.ok) throw new Error(ordersJson.error || 'Orders laden mislukt')
      if (!planningRes.ok) throw new Error(planningJson.error || 'Planning laden mislukt')

      setOrders(ordersJson.orders || [])
      setPlanning(planningJson.items || [])
      setMachines((machinesJson || []).filter((m: Machine) => m.active !== false && (m.site || 'Wilrijk') === site))
      setEmployees((employeesJson || []).filter((e: Employee) =>
        e.active !== false && ((e.sites && e.sites.length > 0 ? e.sites : ['Wilrijk']).includes(site))
      ))
    } catch (err: any) {
      setError(err.message || 'Planning laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [date, site, viewMode])

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(site)) {
      setSite(availableSites[0])
    }
  }, [availableSites, site])

  useEffect(() => {
    void load()
  }, [load])

  const candidateLines = useMemo(() => {
    return orders.flatMap(order =>
      order.lines
        .filter(line => line.remainingQty > 0)
        .map(line => ({
          ...line,
          orderNumber: order.orderNumber,
          salesOrderNumber: order.salesOrderNumber,
        }))
    )
  }, [orders])

  const selectedLine = candidateLines.find(line => String(line.id) === selectedLineId)

  const planningByMachine = useMemo(() => {
    const grouped = new Map<string, PlanningItem[]>()
    for (const item of planning) {
      const key = item.machine?.name || 'Niet toegewezen'
      grouped.set(key, [...(grouped.get(key) || []), item])
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [planning])

  const planningByDateAndMachine = useMemo(() => {
    const dates = new Map<string, Map<string, PlanningItem[]>>()
    for (const item of planning) {
      const dateKey = item.planned_date
      const machineKey = item.machine?.name || 'Niet toegewezen'
      const machineMap = dates.get(dateKey) || new Map<string, PlanningItem[]>()
      machineMap.set(machineKey, [...(machineMap.get(machineKey) || []), item])
      dates.set(dateKey, machineMap)
    }
    return Array.from(dates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, machineMap]) => ({
        date: dateKey,
        machines: Array.from(machineMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
      }))
  }, [planning])

  const toggleEmployee = (id: number) => {
    setEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const resetForm = () => {
    setSelectedLineId('')
    setStep(STEPS[0])
    setShift('dag')
    setMachineId('')
    setEmployeeIds([])
    setQuantity('')
    setMinutes('')
    setNotes('')
  }

  const savePlanning = async () => {
    if (!selectedLine) {
      alert('Selecteer eerst een productieorderlijn')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/shop-floor/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order_line_id: selectedLine.id,
          planned_date: date,
          production_step: step,
          shift,
          machine_id: machineId || null,
          assigned_employee_ids: employeeIds,
          site,
          planned_quantity: quantity || selectedLine.remainingQty,
          planned_minutes: minutes || null,
          notes,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Planning opslaan mislukt')
      resetForm()
      await load()
    } catch (err: any) {
      setError(err.message || 'Planning opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item: PlanningItem, status: PlanningItem['status']) => {
    const res = await fetch('/api/shop-floor/planning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status }),
    })
    if (res.ok) await load()
  }

  const movePlanning = async (
    item: PlanningItem,
    updates: { planned_date: string; shift: string; machine_id: number | null }
  ) => {
    const res = await fetch('/api/shop-floor/planning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, ...updates }),
    })
    if (res.ok) await load()
  }

  const deleteItem = async (item: PlanningItem) => {
    if (!confirm(`Planning verwijderen voor ${item.order_number} / ${item.production_step}?`)) return
    const res = await fetch(`/api/shop-floor/planning?id=${item.id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="w-full max-w-none px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Shop floor</p>
            <h1 className="text-3xl font-bold text-slate-900">Productieplanning</h1>
            <p className="mt-1 text-sm text-slate-600">
              Plan productieorderlijnen per bewerking, datum, shift, machine en medewerkers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={site}
              onChange={(e) => {
                setSite(e.target.value as Site)
                setMachineId('')
                setEmployeeIds([])
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {availableSites.map(siteOption => (
                <option key={siteOption} value={siteOption}>{siteOption}</option>
              ))}
            </select>
            <Link href="/shop-floor" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Shop-floor overzicht
            </Link>
            <Link href="/production-order-time" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              Tijd registreren
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nieuwe planning toevoegen — {site}</h2>
              <p className="text-sm text-slate-500">BC-orderlijnen blijven de bron; deze planning is lokaal voor de vloer.</p>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              {(['day', 'week'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    viewMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'day' ? 'Dag' : 'Week'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Productieorderlijn</span>
              <select
                value={selectedLineId}
                onChange={(e) => {
                  const lineId = e.target.value
                  setSelectedLineId(lineId)
                  const line = candidateLines.find(l => String(l.id) === lineId)
                  if (line) setQuantity(String(line.remainingQty))
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecteer orderlijn...</option>
                {candidateLines.map(line => (
                  <option key={line.id} value={line.id}>
                    {line.orderNumber} · {line.itemNumber || '-'} · open {line.remainingQty}/{line.requiredQty}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bewerking</span>
              <select value={step} onChange={(e) => setStep(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {STEPS.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</span>
              <select value={shift} onChange={(e) => setShift(e.target.value as any)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Machine / werkplek</span>
              <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Niet toegewezen</option>
                {machines.map(machine => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}{machine.capacity ? ` · cap. ${machine.capacity}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Aantal</span>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="0" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Geplande minuten</span>
              <input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" min="0" placeholder="Optioneel" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="mt-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Medewerkers</span>
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {employees.map(employee => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => toggleEmployee(employee.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    employeeIds.includes(employee.id)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {employee.name}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notitie</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              onClick={savePlanning}
              disabled={saving || !selectedLineId}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? 'Opslaan...' : 'Toevoegen aan planning'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Planning voor {site} {viewMode === 'week' ? `van ${weekRange(date).from} t.e.m. ${weekRange(date).to}` : `op ${date}`}
              </h2>
              <p className="text-sm text-slate-500">{planning.length} geplande bewerking(en)</p>
            </div>
            <button onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Vernieuwen
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500">Planning laden...</div>
          ) : planning.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Nog geen planning voor deze datum.</div>
          ) : (
            <div className="space-y-4">
              {viewMode === 'day' ? (
                planningByMachine.map(([machineName, items]) => (
                  <div key={machineName} className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <h3 className="font-bold text-slate-900">{machineName}</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map(item => (
                        <PlanningRow key={item.id} item={item} machines={machines} onStatus={updateStatus} onMove={movePlanning} onDelete={deleteItem} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                planningByDateAndMachine.map(group => (
                  <div key={group.date} className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-100 bg-slate-100 px-4 py-3">
                      <h3 className="font-bold text-slate-900">{new Date(`${group.date}T00:00:00`).toLocaleDateString('nl-BE', { weekday: 'long', day: '2-digit', month: '2-digit' })}</h3>
                    </div>
                    <div className="space-y-3 p-3">
                      {group.machines.map(([machineName, items]) => (
                        <div key={`${group.date}-${machineName}`} className="rounded-lg border border-slate-100">
                          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">{machineName}</div>
                          <div className="divide-y divide-slate-100">
                            {items.map(item => (
                              <PlanningRow key={item.id} item={item} machines={machines} onStatus={updateStatus} onMove={movePlanning} onDelete={deleteItem} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function PlanningRow({
  item,
  machines,
  onStatus,
  onMove,
  onDelete,
}: {
  item: PlanningItem
  machines: Machine[]
  onStatus: (item: PlanningItem, status: PlanningItem['status']) => void
  onMove: (item: PlanningItem, updates: { planned_date: string; shift: string; machine_id: number | null }) => void
  onDelete: (item: PlanningItem) => void
}) {
  const [moveDate, setMoveDate] = useState(item.planned_date)
  const [moveShift, setMoveShift] = useState(item.shift)
  const [moveMachineId, setMoveMachineId] = useState(item.machine_id ? String(item.machine_id) : '')

  useEffect(() => {
    setMoveDate(item.planned_date)
    setMoveShift(item.shift)
    setMoveMachineId(item.machine_id ? String(item.machine_id) : '')
  }, [item.planned_date, item.shift, item.machine_id])

  const hasMoveChanges =
    moveDate !== item.planned_date ||
    moveShift !== item.shift ||
    moveMachineId !== (item.machine_id ? String(item.machine_id) : '')

  return (
    <div className="grid gap-3 p-4 xl:grid-cols-[1.3fr_180px_1fr_220px] xl:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{item.order_number}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.production_step}</span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{item.shift}</span>
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">{item.planned_date}</span>
        </div>
        <div className="mt-1 text-sm text-slate-600">
          {item.item_number ? <BcItemCode value={item.item_number} /> : '-'} · {item.description || '-'}
        </div>
        {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
      </div>
      <div className="text-sm text-slate-700">
        <div>Aantal: <strong>{item.planned_quantity ?? '-'}</strong></div>
        <div>Tijd: {item.planned_minutes ? `${item.planned_minutes} min` : '-'}</div>
        <div>Medewerkers: {item.employees?.length ? item.employees.map(e => e.name).join(', ') : '-'}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        <input
          type="date"
          value={moveDate}
          onChange={(e) => setMoveDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <select
          value={moveShift}
          onChange={(e) => setMoveShift(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          {SHIFTS.map(shiftOption => (
            <option key={shiftOption} value={shiftOption}>{shiftOption}</option>
          ))}
        </select>
        <select
          value={moveMachineId}
          onChange={(e) => setMoveMachineId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Niet toegewezen</option>
          {machines.map(machine => (
            <option key={machine.id} value={machine.id}>{machine.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!hasMoveChanges}
          onClick={() => onMove(item, {
            planned_date: moveDate,
            shift: moveShift,
            machine_id: moveMachineId ? Number(moveMachineId) : null,
          })}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-3 xl:col-span-1"
        >
          Verplaats
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={item.status}
          onChange={(e) => onStatus(item, e.target.value as PlanningItem['status'])}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="planned">Gepland</option>
          <option value="released">Vrijgegeven</option>
          <option value="in_progress">Bezig</option>
          <option value="done">Klaar</option>
          <option value="cancelled">Geannuleerd</option>
        </select>
        <button onClick={() => onDelete(item)} className="rounded-lg border border-red-200 px-2 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">
          Verwijder
        </button>
      </div>
    </div>
  )
}
