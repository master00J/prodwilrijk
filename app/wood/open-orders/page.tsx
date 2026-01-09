'use client'

import { useState, useEffect } from 'react'
import { WoodOrder } from '@/types/database'

export default function OpenOrdersPage() {
  const [orders, setOrders] = useState<WoodOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<WoodOrder | null>(null)
  const [registerData, setRegisterData] = useState({
    pakketnummer: '',
    exacte_dikte: '',
    exacte_breedte: '',
    exacte_lengte: '',
    planken_per_pak: '',
    opmerking: '',
  })

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/wood/open-orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data = await response.json()
      setOrders(data)
    } catch (error) {
      console.error('Error fetching orders:', error)
      alert('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchOrders, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const handleTogglePriority = async (id: number, currentPriority: boolean) => {
    try {
      const response = await fetch('/api/wood/open-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority: !currentPriority }),
      })

      if (!response.ok) throw new Error('Failed to update priority')
      await fetchOrders()
    } catch (error) {
      console.error('Error updating priority:', error)
      alert('Failed to update priority')
    }
  }

  const handleArchive = async (id: number) => {
    if (!confirm('Are you sure you want to archive this order?')) return

    try {
      const response = await fetch('/api/wood/open-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, gearchiveerd: true }),
      })

      if (!response.ok) throw new Error('Failed to archive order')
      await fetchOrders()
    } catch (error) {
      console.error('Error archiving order:', error)
      alert('Failed to archive order')
    }
  }

  const handleOpenRegisterModal = (order: WoodOrder) => {
    setSelectedOrder(order)
    setRegisterData({
      pakketnummer: '',
      exacte_dikte: order.dikte.toString(),
      exacte_breedte: order.breedte.toString(),
      exacte_lengte: order.min_lengte.toString(),
      planken_per_pak: order.planken_per_pak.toString(),
      opmerking: '',
    })
    setShowRegisterModal(true)
  }

  const handleRegisterPackage = async () => {
    if (!selectedOrder || !registerData.pakketnummer || !registerData.exacte_dikte || 
        !registerData.exacte_breedte || !registerData.exacte_lengte || !registerData.planken_per_pak) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/wood/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          pakketnummer: registerData.pakketnummer,
          houtsoort: selectedOrder.houtsoort,
          exacte_dikte: registerData.exacte_dikte,
          exacte_breedte: registerData.exacte_breedte,
          exacte_lengte: registerData.exacte_lengte,
          planken_per_pak: registerData.planken_per_pak,
          opmerking: registerData.opmerking || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to register package')
      }

      alert('Package registered successfully!')
      setShowRegisterModal(false)
      setSelectedOrder(null)
      setRegisterData({
        pakketnummer: '',
        exacte_dikte: '',
        exacte_breedte: '',
        exacte_lengte: '',
        planken_per_pak: '',
        opmerking: '',
      })
    } catch (error) {
      console.error('Error registering package:', error)
      alert(error instanceof Error ? error.message : 'Failed to register package')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Open Orders</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Length</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Width</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planks/Pack</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BC Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered On</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-4 text-center text-gray-500">
                    No open orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const progress = order.aantal_pakken > 0 
                    ? (order.ontvangen_pakken / order.aantal_pakken) * 100 
                    : 0
                  
                  return (
                    <tr
                      key={order.id}
                      className={order.priority ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.houtsoort}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.min_lengte} mm
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.dikte} mm
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.breedte} mm
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.aantal_pakken}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.ontvangen_pakken}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.open_pakken}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.planken_per_pak}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.bc_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.locatie || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {order.opmerkingen || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.besteld_op).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePriority(order.id, order.priority)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            order.priority
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {order.priority ? 'High' : 'Normal'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenRegisterModal(order)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Register Package
                          </button>
                          <button
                            onClick={() => handleArchive(order.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Package Modal */}
      {showRegisterModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Register Package for Receipt</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p><strong>Order:</strong> {selectedOrder.houtsoort} - {selectedOrder.dikte}x{selectedOrder.breedte}x{selectedOrder.min_lengte}mm</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-medium">Package Number *</label>
                <input
                  type="text"
                  value={registerData.pakketnummer}
                  onChange={(e) => setRegisterData({ ...registerData, pakketnummer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Planks per Package *</label>
                <input
                  type="number"
                  value={registerData.planken_per_pak}
                  onChange={(e) => setRegisterData({ ...registerData, planken_per_pak: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Thickness (mm) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={registerData.exacte_dikte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_dikte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Width (mm) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={registerData.exacte_breedte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_breedte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Exact Length (mm) *</label>
                <input
                  type="number"
                  value={registerData.exacte_lengte}
                  onChange={(e) => setRegisterData({ ...registerData, exacte_lengte: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Comment (optional)</label>
              <textarea
                value={registerData.opmerking}
                onChange={(e) => setRegisterData({ ...registerData, opmerking: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterPackage}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Register Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

