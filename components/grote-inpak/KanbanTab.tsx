'use client'

import { useEffect, useMemo, useState } from 'react'

interface KanbanPlanRow {
  case_type: string
  gemiddeld_per_dag: number
  stapel: number
  kanbans: number
  posities: number
  locatie: string
  productielocatie: string
}

type Slot = {
  case_type: string
  locatie: string
  capacity: number
  usage: number
  assigned: number
}

export default function KanbanTab() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 180)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [leadTimeDays, setLeadTimeDays] = useState(5)
  const [stacksPerPos, setStacksPerPos] = useState(2)
  const [safetyFactor, setSafetyFactor] = useState(1.2)
  const [manualEnabled, setManualEnabled] = useState(false)
  const [manualPositions, setManualPositions] = useState<Record<string, number>>({})
  const [plan, setPlan] = useState<KanbanPlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPlan = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
          lead_time_days: String(leadTimeDays),
          stacks_per_pos: String(stacksPerPos),
          safety_factor: String(safetyFactor),
          only_c: 'true',
        })
        const response = await fetch(`/api/grote-inpak/kanban?${params.toString()}`)
        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Kanban plan laden mislukt')
        }
        const result = await response.json()
        setPlan(result.plan || [])
      } catch (err: any) {
        setError(err.message || 'Kanban plan laden mislukt')
      } finally {
        setLoading(false)
      }
    }
    loadPlan()
  }, [dateFrom, dateTo, leadTimeDays, stacksPerPos, safetyFactor])

  const slots = useMemo(() => {
    const slotMap: Record<number, Slot> = {}
    const occupied = new Array(65).fill(false)

    const placeCase = (row: KanbanPlanRow, startPos: number) => {
      const capacity = row.stapel * stacksPerPos
      const neededPositions = Math.max(1, row.posities)
      let remaining = Math.max(1, row.kanbans)
      let position = Math.max(1, Math.min(64, startPos))
      let placed = 0

      while (placed < neededPositions && occupied.slice(1).some((x) => !x)) {
        for (let step = 0; step < 64; step++) {
          const idx = ((position - 1 + step) % 64) + 1
          if (!occupied[idx]) {
            const assign = Math.max(1, Math.min(stacksPerPos, remaining))
            slotMap[idx] = {
              case_type: row.case_type,
              locatie: row.locatie,
              capacity,
              usage: row.gemiddeld_per_dag,
              assigned: assign,
            }
            occupied[idx] = true
            remaining = Math.max(0, remaining - assign)
            placed += 1
            position = idx + 1
            break
          }
        }
      }
    }

    if (manualEnabled) {
      plan.forEach((row) => {
        const manual = manualPositions[row.case_type]
        if (manual) {
          placeCase(row, manual)
        }
      })
    }

    plan.forEach((row) => {
      if (manualEnabled && manualPositions[row.case_type]) {
        return
      }
      const firstFree = occupied.findIndex((value, index) => index > 0 && !value)
      if (firstFree === -1) return
      placeCase(row, firstFree)
    })

    return slotMap
  }, [plan, manualEnabled, manualPositions, stacksPerPos])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📦 Kanban Rekken</h2>
      <p className="text-sm text-gray-500 mb-4">
        Automatische vulling o.b.v. verbruik, levertijd en stapelhoogte (C-kisten).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Van</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tot</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Levertijd (werkdagen)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(Number(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stapels per positie</label>
          <input
            type="number"
            min={1}
            max={3}
            value={stacksPerPos}
            onChange={(e) => setStacksPerPos(Number(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Veiligheidsfactor</label>
          <input
            type="number"
            step={0.05}
            min={1}
            max={2}
            value={safetyFactor}
            onChange={(e) => setSafetyFactor(Number(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500">Kanban plan laden...</div>
      ) : (
        <>
          <div className="mb-6">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={manualEnabled}
                onChange={(e) => setManualEnabled(e.target.checked)}
              />
              Handmatige posities instellen
            </label>
          </div>

          {manualEnabled && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">Handmatige startposities</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plan.map((row) => (
                  <div key={row.case_type} className="flex items-center gap-3">
                    <span className="font-medium w-20">{row.case_type}</span>
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={manualPositions[row.case_type] || ''}
                      onChange={(e) =>
                        setManualPositions({
                          ...manualPositions,
                          [row.case_type]: Number(e.target.value) || 1,
                        })
                      }
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                      placeholder="Pos"
                    />
                    <span className="text-xs text-gray-500">{row.posities} pos.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3">Indelingsoverzicht</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kist Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verbruik/Dag</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stapel</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kanbans</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Posities</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {plan.map((row) => (
                    <tr key={row.case_type}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.case_type}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.gemiddeld_per_dag.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.stapel}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.kanbans}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.posities}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.locatie}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Raster (64 posities)</h3>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-200 rounded"></span>Wilrijk</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-200 rounded"></span>Genk</span>
              </div>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 64 }).map((_, idx) => {
                const pos = idx + 1
                const slot = slots[pos]
                const isGenk = slot?.locatie === 'G'
                return (
                  <div
                    key={pos}
                    className={`border rounded p-2 text-xs min-h-[58px] ${
                      slot ? (isGenk ? 'bg-green-100 border-green-300' : 'bg-blue-100 border-blue-300') : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-gray-500">Pos {pos}</div>
                    {slot && (
                      <div className="mt-1 font-semibold text-gray-800">{slot.case_type}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
