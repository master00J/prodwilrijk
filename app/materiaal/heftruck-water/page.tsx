'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

type Employee = { id: number; name: string }
type LogRow = {
  id: number
  employee_id: number | null
  employee_name?: string | null
  heftruck: string
  filled_at: string
  note?: string | null
}

export default function HeftruckWaterPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employeeId, setEmployeeId] = useState<string>('')
  const [heftruck, setHeftruck] = useState('')
  const [filledAt, setFilledAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [empRes, logRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/materiaal/heftruck-water'),
      ])
      if (empRes.ok) {
        const data = await empRes.json()
        setEmployees(data || [])
      }
      if (logRes.ok) {
        const data = await logRes.json()
        setLogs(data.items || [])
      }
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async () => {
    if (!heftruck || !filledAt) {
      alert('Heftruck en datum/tijd zijn verplicht')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/materiaal/heftruck-water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId || null,
          heftruck,
          filled_at: filledAt,
          note,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Opslaan mislukt')
      }
      setHeftruck('')
      setNote('')
      setFilledAt(new Date().toISOString().slice(0, 16))
      await loadData()
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Heftruck Water Bijvullen</h1>
        <p className="text-sm text-gray-600">Registreer wie wanneer welke heftruck heeft bijgevuld.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Werknemer</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">— Selecteer —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heftruck</label>
            <input
              type="text"
              value={heftruck}
              onChange={(e) => setHeftruck(e.target.value)}
              placeholder="Bijv. H1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum & tijd</label>
            <input
              type="datetime-local"
              value={filledAt}
              onChange={(e) => setFilledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notitie</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optioneel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historiek</h2>
          <button onClick={loadData} className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">
            Verversen
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Werknemer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heftruck</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notitie</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Laden...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Nog geen registraties
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(row.filled_at).toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.employee_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.heftruck}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
