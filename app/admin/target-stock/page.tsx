'use client'

import { useState, useEffect } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { WoodTargetStock } from '@/types/database'

export default function TargetStockPage() {
  const [targetStock, setTargetStock] = useState<WoodTargetStock[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    houtsoort: '',
    dikte: '',
    breedte: '',
    target_packs: '',
    desired_length: '',
  })
  const [searchTerm, setSearchTerm] = useState('')

  const houtsoorten = ['SXT', 'SCH', 'NHV', 'OSB', 'MEP', 'HDB', 'KD', 'HBO', 'MPX']

  const fetchTargetStock = async () => {
    try {
      const response = await fetch('/api/wood/target-stock')
      if (!response.ok) throw new Error('Failed to fetch target stock')
      const data = await response.json()
      setTargetStock(data)
    } catch (error) {
      console.error('Error fetching target stock:', error)
      alert('Failed to load target stock')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTargetStock()
  }, [])

  const handleAdd = () => {
    setFormData({ houtsoort: '', dikte: '', breedte: '', target_packs: '', desired_length: '' })
    setEditingId(null)
    setShowAddModal(true)
  }

  const handleEdit = (item: WoodTargetStock) => {
    setFormData({
      houtsoort: item.houtsoort,
      dikte: item.dikte.toString(),
      breedte: item.breedte.toString(),
      target_packs: item.target_packs.toString(),
      desired_length: item.desired_length?.toString() || '',
    })
    setEditingId(item.id)
    setShowAddModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this target stock entry?')) return

    try {
      const response = await fetch(`/api/wood/target-stock?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete target stock')
      await fetchTargetStock()
    } catch (error) {
      console.error('Error deleting target stock:', error)
      alert('Failed to delete target stock')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.houtsoort || !formData.dikte || !formData.breedte || !formData.target_packs) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const url = '/api/wood/target-stock'
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
        throw new Error(error.error || 'Failed to save target stock')
      }

      setShowAddModal(false)
      setEditingId(null)
      setFormData({ houtsoort: '', dikte: '', breedte: '', target_packs: '', desired_length: '' })
      await fetchTargetStock()
    } catch (error) {
      console.error('Error saving target stock:', error)
      alert(error instanceof Error ? error.message : 'Failed to save target stock')
    }
  }

  const filteredTargetStock = targetStock.filter(item => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.houtsoort.toLowerCase().includes(search) ||
      item.dikte.toString().includes(search) ||
      item.breedte.toString().includes(search) ||
      item.target_packs.toString().includes(search)
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
            <h1 className="text-3xl font-bold text-gray-900">Target Stock Management</h1>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Add Target Stock
            </button>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by wood type, dimensions, target packs..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Packs</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desired Length (mm)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTargetStock.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      {searchTerm ? 'No target stock found matching your search' : 'No target stock found. Add one to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredTargetStock.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.houtsoort}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dikte}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.breedte}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.target_packs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.desired_length || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
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
                  {editingId ? 'Edit Target Stock' : 'Add Target Stock'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingId(null)
                    setFormData({ houtsoort: '', dikte: '', breedte: '', target_packs: '', desired_length: '' })
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
                    step="0.01"
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
                    step="0.01"
                    value={formData.breedte}
                    onChange={(e) => setFormData({ ...formData, breedte: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Target Packs *</label>
                  <input
                    type="number"
                    value={formData.target_packs}
                    onChange={(e) => setFormData({ ...formData, target_packs: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Desired Length (mm) (optional)</label>
                  <input
                    type="number"
                    value={formData.desired_length}
                    onChange={(e) => setFormData({ ...formData, desired_length: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave empty for default"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setEditingId(null)
                      setFormData({ houtsoort: '', dikte: '', breedte: '', target_packs: '', desired_length: '' })
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



