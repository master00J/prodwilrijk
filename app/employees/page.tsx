'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/types/database'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formName, setFormName] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [includeInactive])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const params = includeInactive ? '?include_inactive=true' : ''
      const response = await fetch(`/api/employees${params}`)
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

  const handleAdd = () => {
    setEditingEmployee(null)
    setFormName('')
    setFormActive(true)
    setShowAddForm(true)
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormName(employee.name)
    setFormActive(employee.active !== false)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingEmployee(null)
    setFormName('')
    setFormActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formName.trim()) {
      alert('Please enter a name')
      return
    }

    try {
      if (editingEmployee) {
        // Update existing employee
        const response = await fetch('/api/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEmployee.id,
            name: formName.trim(),
            active: formActive,
          }),
        })

        if (!response.ok) throw new Error('Failed to update employee')
      } else {
        // Create new employee
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            active: formActive,
          }),
        })

        if (!response.ok) throw new Error('Failed to create employee')
      }

      await fetchEmployees()
      handleCancel()
      alert(editingEmployee ? 'Employee updated successfully' : 'Employee added successfully')
    } catch (error) {
      console.error('Error saving employee:', error)
      alert('Failed to save employee')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) throw new Error('Failed to delete employee')

      await fetchEmployees()
      alert('Employee deleted successfully')
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Failed to delete employee')
    }
  }

  const handleToggleActive = async (employee: Employee) => {
    try {
      const response = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: employee.id,
          active: !employee.active,
        }),
      })

      if (!response.ok) throw new Error('Failed to update employee')

      await fetchEmployees()
    } catch (error) {
      console.error('Error updating employee:', error)
      alert('Failed to update employee')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Employees</h1>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
        >
          + Add Employee
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-lg">Show inactive employees</span>
        </label>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-medium">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-5 h-5"
                />
                <span>Active</span>
              </label>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
              >
                {editingEmployee ? 'Update' : 'Add'} Employee
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className={employee.active === false ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">{employee.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          employee.active !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {employee.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {employee.created_at
                        ? new Date(employee.created_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(employee)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            employee.active !== false
                              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          {employee.active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
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

