'use client'

import { useEffect, useState } from 'react'
import { X, User, Loader2 } from 'lucide-react'

interface Employee {
  id: number
  name: string
}

interface EmployeePickerModalProps {
  itemCount: number
  onConfirm: (employeeId: number, employeeName: string) => void
  onCancel: () => void
}

export default function EmployeePickerModal({
  itemCount,
  onConfirm,
  onCancel,
}: EmployeePickerModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('/api/employees')
        if (!res.ok) throw new Error('Laden mislukt')
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [])
      } catch {
        setError('Medewerkers konden niet geladen worden.')
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [])

  const handleConfirm = () => {
    const emp = employees.find(e => e.id === selected)
    if (!emp) return
    onConfirm(emp.id, emp.name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Wie heeft ingepakt?</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {itemCount} item{itemCount !== 1 ? 's' : ''} worden gemarkeerd als verpakt
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Medewerkers laden...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Geen actieve medewerkers gevonden
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelected(emp.id)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all font-medium text-sm ${
                    selected === emp.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <User className={`w-4 h-4 shrink-0 ${selected === emp.id ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className="truncate">{emp.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected === null}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Bevestigen
          </button>
        </div>
      </div>
    </div>
  )
}
