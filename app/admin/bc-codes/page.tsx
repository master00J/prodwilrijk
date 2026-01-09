'use client'

import { useState, useEffect } from 'react'
import AdminGuard from '@/components/AdminGuard'

interface BcCode {
  id: number
  breedte: number
  dikte: number
  houtsoort: string
  bc_code: string
  created_at?: string
  updated_at?: string
}

export default function BcCodesPage() {
  const [bcCodes, setBcCodes] = useState<BcCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    breedte: '',
    dikte: '',
    houtsoort: '',
    bc_code: '',
  })
  const [searchTerm, setSearchTerm] = useState('')

  const houtsoorten = ['SXT', 'SCH', 'NHV', 'OSB', 'MEP', 'HDB']

  const fetchBcCodes = async () => {
    try {
      const response = await fetch('/api/admin/bc-codes')
      if (!response.ok) throw new Error('Failed to fetch BC codes')
      const data = await response.json()
      setBcCodes(data)
    } catch (error) {
      console.error('Error fetching BC codes:', error)
      alert('Failed to load BC codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBcCodes()
  }, [])

  const handleAdd = () => {
    setFormData({ breedte: '', dikte: '', houtsoort: '', bc_code: '' })
    setEditingId(null)
    setShowAddModal(true)
  }

  const handleEdit = (bcCode: BcCode) => {
    setFormData({
      breedte: bcCode.breedte.toString(),
      dikte: bcCode.dikte.toString(),
      houtsoort: bcCode.houtsoort,
      bc_code: bcCode.bc_code,
    })
    setEditingId(bcCode.id)
    setShowAddModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this BC code?')) return

    try {
      const response = await fetch(`/api/admin/bc-codes?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete BC code')
      await fetchBcCodes()
    } catch (error) {
      console.error('Error deleting BC code:', error)
      alert('Failed to delete BC code')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.breedte || !formData.dikte || !formData.houtsoort || !formData.bc_code) {
      alert('Please fill in all fields')
      return
    }

    try {
      const url = '/api/admin/bc-codes'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? { id: editingId, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save BC code')
      }

      setShowAddModal(false)
      setEditingId(null)
      setFormData({ breedte: '', dikte: '', houtsoort: '', bc_code: '' })
      await fetchBcCodes()
    } catch (error) {
      console.error('Error saving BC code:', error)
      alert(error instanceof Error ? error.message : 'Failed to save BC code')
    }
  }

  const filteredBcCodes = bcCodes.filter(bc => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      bc.houtsoort.toLowerCase().includes(search) ||
      bc.bc_code.toLowerCase().includes(search) ||
      bc.breedte.toString().includes(search) ||
      bc.dikte.toString().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">BC Codes Management</h1>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Add BC Code
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by wood type, BC code, dimensions..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Width (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BC Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBcCodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'No BC codes found matching your search' : 'No BC codes found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                filteredBcCodes.map((bc) => (
                  <tr key={bc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {bc.houtsoort}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bc.dikte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bc.breedte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bc.bc_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(bc)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(bc.id)}
                          className="text-red-600 hover:text-red-900"
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Edit BC Code' : 'Add BC Code'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingId(null)
                  setFormData({ breedte: '', dikte: '', houtsoort: '', bc_code: '' })
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-medium">Wood Type *</label>
                <select
                  value={formData.houtsoort}
                  onChange={(e) => setFormData({ ...formData, houtsoort: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select wood type</option>
                  {houtsoorten.map(soort => (
                    <option key={soort} value={soort}>{soort}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium">Thickness (mm) *</label>
                <input
                  type="number"
                  value={formData.dikte}
                  onChange={(e) => setFormData({ ...formData, dikte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Width (mm) *</label>
                <input
                  type="number"
                  value={formData.breedte}
                  onChange={(e) => setFormData({ ...formData, breedte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">BC Code *</label>
                <input
                  type="text"
                  value={formData.bc_code}
                  onChange={(e) => setFormData({ ...formData, bc_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingId(null)
                    setFormData({ breedte: '', dikte: '', houtsoort: '', bc_code: '' })
                  }}
                  className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminGuard>
  )
}

