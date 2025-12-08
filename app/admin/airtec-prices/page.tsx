'use client'

import { useState, useEffect } from 'react'
import AdminGuard from '@/components/AdminGuard'

interface AirtecPrice {
  kistnummer: string
  erp_code: string | null
  price: number
  assembly_cost: number
  material_cost: number
  transport_cost: number
  created_at?: string
  updated_at?: string
}

export default function AirtecPricesPage() {
  const [prices, setPrices] = useState<AirtecPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AirtecPrice>>({})
  const [newPrice, setNewPrice] = useState({
    kistnummer: '',
    erp_code: '',
    price: '',
    assembly_cost: '',
    material_cost: '',
    transport_cost: '',
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchPrices()
  }, [])

  const fetchPrices = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/airtec-prices')
      if (!response.ok) throw new Error('Failed to fetch prices')
      const data = await response.json()
      setPrices(data.prices || [])
    } catch (error) {
      console.error('Error fetching prices:', error)
      setMessage({ type: 'error', text: 'Failed to load prices' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (price: AirtecPrice) => {
    setEditing(price.kistnummer)
    setEditForm({
      erp_code: price.erp_code || '',
      price: price.price,
      assembly_cost: price.assembly_cost,
      material_cost: price.material_cost,
      transport_cost: price.transport_cost,
    })
  }

  const handleSave = async (kistnummer: string) => {
    try {
      const response = await fetch(`/api/airtec-prices/${kistnummer}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update price')
      }

      setMessage({ type: 'success', text: 'Price updated successfully' })
      setEditing(null)
      await fetchPrices()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update price' })
    }
  }

  const handleCancel = () => {
    setEditing(null)
    setEditForm({})
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/airtec-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kistnummer: newPrice.kistnummer.trim(),
          erp_code: newPrice.erp_code.trim() || null,
          price: parseFloat(newPrice.price) || 0,
          assembly_cost: parseFloat(newPrice.assembly_cost) || 0,
          material_cost: parseFloat(newPrice.material_cost) || 0,
          transport_cost: parseFloat(newPrice.transport_cost) || 0,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add price')
      }

      setMessage({ type: 'success', text: 'Price added successfully' })
      setNewPrice({
        kistnummer: '',
        erp_code: '',
        price: '',
        assembly_cost: '',
        material_cost: '',
        transport_cost: '',
      })
      await fetchPrices()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to add price' })
    }
  }

  const handleDelete = async (kistnummer: string) => {
    if (!confirm(`Are you sure you want to delete the price for box ${kistnummer}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/airtec-prices/${kistnummer}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete price')
      }

      setMessage({ type: 'success', text: 'Price deleted successfully' })
      await fetchPrices()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete price' })
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
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Airtec Prices & ERP Codes Management</h1>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add New Price Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Add New Box Price</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block mb-2 font-medium text-sm">Box Number (Kistnummer)</label>
            <input
              type="text"
              value={newPrice.kistnummer}
              onChange={(e) => setNewPrice({ ...newPrice, kistnummer: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={3}
              placeholder="001"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-sm">ERP Code</label>
            <input
              type="text"
              value={newPrice.erp_code}
              onChange={(e) => setNewPrice({ ...newPrice, erp_code: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ERP123"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-sm">Price</label>
            <input
              type="number"
              step="0.01"
              value={newPrice.price}
              onChange={(e) => setNewPrice({ ...newPrice, price: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-sm">Assembly Cost</label>
            <input
              type="number"
              step="0.01"
              value={newPrice.assembly_cost}
              onChange={(e) => setNewPrice({ ...newPrice, assembly_cost: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-sm">Material Cost</label>
            <input
              type="number"
              step="0.01"
              value={newPrice.material_cost}
              onChange={(e) => setNewPrice({ ...newPrice, material_cost: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium text-sm">Transport Cost</label>
            <input
              type="number"
              step="0.01"
              value={newPrice.transport_cost}
              onChange={(e) => setNewPrice({ ...newPrice, transport_cost: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-6">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Add Price
            </button>
          </div>
        </form>
      </div>

      {/* Prices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Box Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  ERP Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Assembly Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Material Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Transport Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No prices found. Add your first box price above.
                  </td>
                </tr>
              ) : (
                prices.map((price) => (
                  <tr key={price.kistnummer}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {price.kistnummer}
                    </td>
                    {editing === price.kistnummer ? (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="text"
                            value={editForm.erp_code || ''}
                            onChange={(e) => setEditForm({ ...editForm, erp_code: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="ERP Code"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.price || ''}
                            onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.assembly_cost || ''}
                            onChange={(e) => setEditForm({ ...editForm, assembly_cost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.material_cost || ''}
                            onChange={(e) => setEditForm({ ...editForm, material_cost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.transport_cost || ''}
                            onChange={(e) => setEditForm({ ...editForm, transport_cost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(price.kistnummer)}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {price.erp_code || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          €{price.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          €{price.assembly_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          €{price.material_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          €{price.transport_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(price)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(price.kistnummer)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AdminGuard>
  )
}

