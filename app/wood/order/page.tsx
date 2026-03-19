'use client'

import { useState } from 'react'
import { WoodOrder } from '@/types/database'

interface OrderItem {
  houtsoort: string
  minLengte: string
  dikte: string
  breedte: string
  aantalPakken: string
  plankenPerPak: string
  opmerkingen: string
}

export default function WoodOrderPage() {
  const [orderList, setOrderList] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<OrderItem>({
    houtsoort: '',
    minLengte: '',
    dikte: '',
    breedte: '',
    aantalPakken: '',
    plankenPerPak: '50',
    opmerkingen: '',
  })

  const houtsoorten = ['SXT', 'SCH', 'NHV', 'OSB', 'MEP', 'HDB']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.houtsoort || !formData.minLengte || !formData.dikte || 
        !formData.breedte || !formData.aantalPakken) {
      alert('Please fill in all required fields')
      return
    }

    setOrderList([...orderList, { ...formData }])
    setFormData({
      houtsoort: '',
      minLengte: '',
      dikte: '',
      breedte: '',
      aantalPakken: '',
      plankenPerPak: '50',
      opmerkingen: '',
    })
  }

  const removeItem = (index: number) => {
    setOrderList(orderList.filter((_, i) => i !== index))
  }

  const handleAddToOpenOrders = async () => {
    if (orderList.length === 0) {
      alert('The order list is empty. Please add items first.')
      return
    }

    setLoading(true)
    try {
      const ordersToSubmit = orderList.map(item => ({
        houtsoort: item.houtsoort,
        min_lengte: parseInt(item.minLengte),
        dikte: parseInt(item.dikte),
        breedte: parseInt(item.breedte),
        aantal_pakken: parseInt(item.aantalPakken),
        planken_per_pak: parseInt(item.plankenPerPak || '50'),
        opmerkingen: item.opmerkingen || null,
        priority: false,
      }))

      const response = await fetch('/api/wood/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ordersToSubmit),
      })

      if (!response.ok) throw new Error('Failed to create orders')

      alert('Orders successfully added to open orders!')
      setOrderList([])
    } catch (error) {
      console.error('Error creating orders:', error)
      alert('Failed to create orders')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Order Wood</h1>
          <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg">
            Items: {orderList.length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label className="block mb-2 font-medium">Minimum Length (mm) *</label>
            <input
              type="number"
              value={formData.minLengte}
              onChange={(e) => setFormData({ ...formData, minLengte: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
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
            <label className="block mb-2 font-medium">Number of Packages *</label>
            <input
              type="number"
              value={formData.aantalPakken}
              onChange={(e) => setFormData({ ...formData, aantalPakken: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Planks per Package</label>
            <input
              type="number"
              value={formData.plankenPerPak}
              onChange={(e) => setFormData({ ...formData, plankenPerPak: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="50"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-2 font-medium">Comments</label>
            <textarea
              value={formData.opmerkingen}
              onChange={(e) => setFormData({ ...formData, opmerkingen: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Add to List
            </button>
          </div>
        </form>
      </div>

      {orderList.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Order List</h2>
          <div className="space-y-3">
            {orderList.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 relative hover:shadow-md transition-shadow">
                <button
                  onClick={() => removeItem(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl"
                >
                  ×
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <strong>Wood Type:</strong> {item.houtsoort}
                    <br />
                    <strong>Packages:</strong> {item.aantalPakken}
                  </div>
                  <div>
                    <strong>Dimensions:</strong> {item.minLengte} x {item.breedte} x {item.dikte} mm
                    {item.opmerkingen && (
                      <>
                        <br />
                        <strong>Comments:</strong> {item.opmerkingen}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={handleAddToOpenOrders}
          disabled={loading || orderList.length === 0}
          className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add to Open Orders'}
        </button>
      </div>
    </div>
  )
}



