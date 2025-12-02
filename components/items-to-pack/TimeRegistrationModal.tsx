'use client'

import { useState, useEffect } from 'react'

interface Employee {
  id: number
  name: string
}

interface TimeRegistrationModalProps {
  onClose: () => void
  onStart: (employeeIds: number[]) => void
}

export default function TimeRegistrationModal({
  onClose,
  onStart,
}: TimeRegistrationModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees')
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error('Error fetching employees:', error)
      alert('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleEmployee = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    )
  }

  const handleStart = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one employee')
      return
    }

    setStarting(true)
    try {
      await onStart(selectedIds)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Start Time Registration</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">Select Employees</label>
            {loading ? (
              <div className="text-center py-4">Loading employees...</div>
            ) : (
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {employees.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No employees found
                  </div>
                ) : (
                  employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(employee.id)}
                        onChange={() => handleToggleEmployee(employee.id)}
                        className="w-5 h-5 mr-3 cursor-pointer"
                      />
                      <span className="text-lg">{employee.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Hold CTRL/CMD to select multiple employees
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={starting}
              className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium disabled:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={starting || selectedIds.length === 0}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {starting ? 'Starting...' : 'Start Timer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

