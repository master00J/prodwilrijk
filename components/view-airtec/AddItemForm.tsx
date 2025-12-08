'use client'

import { useState } from 'react'

interface AddItemFormProps {
  onItemAdded: () => void
}

export default function AddItemForm({ onItemAdded }: AddItemFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    beschrijving: '',
    item_number: '',
    lot_number: '',
    datum_opgestuurd: '',
    kistnummer: '',
    divisie: '',
    quantity: '1',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/incoming-goods-airtec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          beschrijving: formData.beschrijving || null,
          item_number: formData.item_number || null,
          lot_number: formData.lot_number || null,
          datum_opgestuurd: formData.datum_opgestuurd || null,
          kistnummer: formData.kistnummer || null,
          divisie: formData.divisie || null,
          quantity: parseInt(formData.quantity) || 1,
        }]),
      })

      if (!response.ok) throw new Error('Failed to add item')

      setFormData({
        beschrijving: '',
        item_number: '',
        lot_number: '',
        datum_opgestuurd: '',
        kistnummer: '',
        divisie: '',
        quantity: '1',
      })
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
      <h2 className="text-xl font-semibold mb-4">Add New Incoming Good (Airtec)</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block mb-2 font-medium">Description</label>
          <input
            type="text"
            value={formData.beschrijving}
            onChange={(e) => setFormData({ ...formData, beschrijving: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Item Number</label>
          <input
            type="text"
            value={formData.item_number}
            onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Lot Number</label>
          <input
            type="text"
            value={formData.lot_number}
            onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Date Sent</label>
          <input
            type="date"
            value={formData.datum_opgestuurd}
            onChange={(e) => setFormData({ ...formData, datum_opgestuurd: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Box Number (Kistnummer)</label>
          <input
            type="text"
            value={formData.kistnummer}
            onChange={(e) => setFormData({ ...formData, kistnummer: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={3}
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Division</label>
          <input
            type="text"
            value={formData.divisie}
            onChange={(e) => setFormData({ ...formData, divisie: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Quantity</label>
          <input
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
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

