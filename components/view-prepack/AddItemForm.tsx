'use client'

import { useState } from 'react'

interface AddItemFormProps {
  onItemAdded: () => void
}

export default function AddItemForm({ onItemAdded }: AddItemFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    item_number: '',
    po_number: '',
    amount: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/incoming-goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          item_number: formData.item_number,
          po_number: formData.po_number,
          amount: parseInt(formData.amount) || 1,
        }]),
      })

      if (!response.ok) throw new Error('Failed to add item')

      setFormData({ item_number: '', po_number: '', amount: '' })
      onItemAdded()
      alert('Item added successfully')
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Failed to add item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Add New Incoming Good</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block mb-2 font-medium">Item Number</label>
          <input
            type="text"
            value={formData.item_number}
            onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">PO Number</label>
          <input
            type="text"
            value={formData.po_number}
            onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Amount</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            min="1"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-medium"
          >
            {loading ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  )
}



