'use client'

import { useState, useEffect, useRef } from 'react'
import { WoodOrder } from '@/types/database'

// Editable Cell Component
interface EditableCellProps {
  orderId: number
  field: string
  value: string | number
  editing: boolean
  onEdit: () => void
  onSave: (value: string) => void
  onCancel: () => void
  type?: 'text' | 'number'
  suffix?: string
  placeholder?: string
  className?: string
  multiline?: boolean
}

function EditableCell({
  orderId,
  field,
  value,
  editing,
  onEdit,
  onSave,
  onCancel,
  type = 'text',
  suffix = '',
  placeholder = '',
  className = '',
  multiline = false,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [editValue, setEditValue] = useState(value?.toString() || '')

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  useEffect(() => {
    setEditValue(value?.toString() || '')
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleSave = () => {
    if (editValue !== value?.toString()) {
      onSave(editValue)
    } else {
      onCancel()
    }
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || '')
    onCancel()
  }

  if (editing) {
    if (multiline) {
      return (
        <td className={className}>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </td>
      )
    }
    return (
      <td className={className}>
        <div className="flex items-center gap-1">
          {type === 'number' ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-20 px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </td>
    )
  }

  const displayValue = value || placeholder || '-'
  return (
    <td
      className={`${className} cursor-pointer hover:bg-blue-50 transition-colors`}
      onDoubleClick={onEdit}
      title="Double-click to edit"
    >
      {displayValue}{suffix && displayValue !== '-' ? suffix : ''}
    </td>
  )
}

export default function OpenOrdersPage() {
  const [orders, setOrders] = useState<WoodOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [sendingPdf, setSendingPdf] = useState(false)
  const [autoOrderRunning, setAutoOrderRunning] = useState(false)
  const [deletingOrders, setDeletingOrders] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<WoodOrder | null>(null)
  const [editingCell, setEditingCell] = useState<{ orderId: number; field: string } | null>(null)
  const [bcCodes, setBcCodes] = useState<Record<string, string>>({})
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
      
      // Fetch BC codes for all orders and update orders with BC codes
      if (data.length > 0) {
        const itemsForBcCode = data.map((item: WoodOrder) => ({
          breedte: item.breedte,
          dikte: item.dikte,
          houtsoort: item.houtsoort || ''
        }))
        const bcCodesData = await fetchBcCodes(itemsForBcCode)
        setBcCodes(bcCodesData)
        
        // Update orders with BC codes
        const updatedData = data.map((item: WoodOrder) => {
          const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
          const key = `${item.breedte}-${item.dikte}-${houtsoort}`
          return {
            ...item,
            bc_code: bcCodesData[key] || item.bc_code || ''
          }
        })
        setOrders(updatedData)
      } else {
        setOrders(data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      alert('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchBcCodes = async (items: Array<{ breedte: number; dikte: number; houtsoort: string }>) => {
    try {
      const response = await fetch('/api/wood/bc-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!response.ok) return {}
      const data = await response.json()
      return data.bc_codes || {}
    } catch (error) {
      console.error('Error fetching BC codes:', error)
      return {}
    }
  }

  const handleCellEdit = (orderId: number, field: string) => {
    setEditingCell({ orderId, field })
  }

  const handleCellSave = async (orderId: number, field: string, newValue: string) => {
    try {
      const response = await fetch(`/api/wood/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: newValue }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update field')
      }

      // Update local state
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          const updatedOrder = {
            ...order,
            [field]: ['aantal_pakken', 'dikte', 'breedte', 'min_lengte', 'planken_per_pak'].includes(field)
              ? parseFloat(newValue) || 0
              : newValue
          }
          
          // If dimensions or houtsoort changed, update BC code
          if (['dikte', 'breedte', 'houtsoort'].includes(field)) {
            const houtsoort = updatedOrder.houtsoort ? updatedOrder.houtsoort.toLowerCase() : ''
            const key = `${updatedOrder.breedte}-${updatedOrder.dikte}-${houtsoort}`
            updatedOrder.bc_code = bcCodes[key] || ''
          }
          
          return updatedOrder
        }
        return order
      })
      
      setOrders(updatedOrders)
      setEditingCell(null)
    } catch (error) {
      console.error('Error updating field:', error)
      alert(error instanceof Error ? error.message : 'Failed to update field')
      setEditingCell(null)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
  }

  const handleAutoOrder = async () => {
    if (!confirm('Do you want to run automatic ordering based on target stock? This will create orders for items below target levels.')) {
      return
    }

    setAutoOrderRunning(true)
    try {
      const response = await fetch('/api/wood/auto-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to run auto-order')
      }

      const result = await response.json()
      alert(`Auto-order completed! Created ${result.orders?.length || 0} new orders.`)
      await fetchOrders()
    } catch (error) {
      console.error('Error running auto-order:', error)
      alert(error instanceof Error ? error.message : 'Failed to run auto-order')
    } finally {
      setAutoOrderRunning(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedOrders.size} order(s)? This action cannot be undone.`)) {
      return
    }

    setDeletingOrders(true)
    try {
      const response = await fetch('/api/wood/orders/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedOrders) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete orders')
      }

      alert(`Successfully deleted ${selectedOrders.size} order(s)`)
      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error('Error deleting orders:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete orders')
    } finally {
      setDeletingOrders(false)
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

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    }
  }

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedOrders(newSelected)
  }

  const handleSendPdf = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order to send.')
      return
    }

    setSendingPdf(true)
    try {
      const filteredData = orders.filter(item => selectedOrders.has(item.id))

      const itemsForBcCode = filteredData.map(item => ({
        breedte: item.breedte,
        dikte: item.dikte,
        houtsoort: item.houtsoort || ''
      }))

      const bcCodes = await fetchBcCodes(itemsForBcCode)

      const updatedData = filteredData.map(item => {
        const houtsoort = item.houtsoort ? item.houtsoort.toLowerCase() : ''
        const key = `${item.breedte}-${item.dikte}-${houtsoort}`
        return {
          ...item,
          bc_code: bcCodes[key] || ''
        }
      })

      // Sort data: priority first, then by houtsoort, dikte, breedte, lengte
      const sortedData = updatedData.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority ? 1 : -1
        }
        if (a.houtsoort !== b.houtsoort) {
          return a.houtsoort.localeCompare(b.houtsoort)
        }
        const dikteA = parseFloat(a.dikte.toString())
        const dikteB = parseFloat(b.dikte.toString())
        if (dikteA !== dikteB) {
          return dikteA - dikteB
        }
        const breedteA = parseFloat(a.breedte.toString())
        const breedteB = parseFloat(b.breedte.toString())
        if (breedteA !== breedteB) {
          return breedteA - breedteB
        }
        const lengteA = parseFloat(a.min_lengte.toString() || '0')
        const lengteB = parseFloat(b.min_lengte.toString() || '0')
        return lengteA - lengteB
      })

      // Column order for PDF
      const pdfColumnOrder = [
        'dikte',
        'breedte',
        'min_lengte',
        'houtsoort',
        'aantal_pakken',
        'bc_code',
        'opmerkingen',
        'besteld_op'
      ]

      // Column headers for PDF
      const pdfColumnHeaders = {
        'dikte': 'Dikte',
        'breedte': 'Breedte',
        'min_lengte': 'Lengte',
        'houtsoort': 'Houtsoort',
        'aantal_pakken': 'Aantal',
        'bc_code': 'BC Code',
        'opmerkingen': 'Opmerkingen',
        'besteld_op': 'Besteld Op'
      }

      const response = await fetch('/api/wood/send-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderList: sortedData,
          columnOrder: pdfColumnOrder,
          columnHeaders: pdfColumnHeaders
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send PDF')
      }

      alert('Order successfully sent as PDF!')
      setSelectedOrders(new Set())
    } catch (error) {
      console.error('Error sending email with PDF:', error)
      alert(error instanceof Error ? error.message : 'Failed to send order')
    } finally {
      setSendingPdf(false)
    }
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
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            {selectedOrders.size === orders.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleSendPdf}
            disabled={sendingPdf || selectedOrders.size === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {sendingPdf ? 'Sending...' : 'Send PDF'}
          </button>
          <button
            onClick={handleAutoOrder}
            disabled={autoOrderRunning}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {autoOrderRunning ? 'Processing...' : '🤖 Auto-Order'}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={deletingOrders || selectedOrders.size === 0}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {deletingOrders ? 'Deleting...' : '🗑️ Delete Selected'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
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
                  <td colSpan={15} className="px-6 py-4 text-center text-gray-500">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleToggleSelect(order.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <EditableCell
                        orderId={order.id}
                        field="houtsoort"
                        value={order.houtsoort}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'houtsoort'}
                        onEdit={() => handleCellEdit(order.id, 'houtsoort')}
                        onSave={(value) => handleCellSave(order.id, 'houtsoort', value)}
                        onCancel={handleCellCancel}
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="min_lengte"
                        value={order.min_lengte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'min_lengte'}
                        onEdit={() => handleCellEdit(order.id, 'min_lengte')}
                        onSave={(value) => handleCellSave(order.id, 'min_lengte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="dikte"
                        value={order.dikte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'dikte'}
                        onEdit={() => handleCellEdit(order.id, 'dikte')}
                        onSave={(value) => handleCellSave(order.id, 'dikte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="breedte"
                        value={order.breedte}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'breedte'}
                        onEdit={() => handleCellEdit(order.id, 'breedte')}
                        onSave={(value) => handleCellSave(order.id, 'breedte', value)}
                        onCancel={handleCellCancel}
                        suffix=" mm"
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="aantal_pakken"
                        value={order.aantal_pakken}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'aantal_pakken'}
                        onEdit={() => handleCellEdit(order.id, 'aantal_pakken')}
                        onSave={(value) => handleCellSave(order.id, 'aantal_pakken', value)}
                        onCancel={handleCellCancel}
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.ontvangen_pakken}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.open_pakken}
                      </td>
                      <EditableCell
                        orderId={order.id}
                        field="planken_per_pak"
                        value={order.planken_per_pak}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'planken_per_pak'}
                        onEdit={() => handleCellEdit(order.id, 'planken_per_pak')}
                        onSave={(value) => handleCellSave(order.id, 'planken_per_pak', value)}
                        onCancel={handleCellCancel}
                        type="number"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="bc_code"
                        value={order.bc_code || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'bc_code'}
                        onEdit={() => handleCellEdit(order.id, 'bc_code')}
                        onSave={(value) => handleCellSave(order.id, 'bc_code', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="locatie"
                        value={order.locatie || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'locatie'}
                        onEdit={() => handleCellEdit(order.id, 'locatie')}
                        onSave={(value) => handleCellSave(order.id, 'locatie', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      />
                      <EditableCell
                        orderId={order.id}
                        field="opmerkingen"
                        value={order.opmerkingen || ''}
                        editing={editingCell?.orderId === order.id && editingCell?.field === 'opmerkingen'}
                        onEdit={() => handleCellEdit(order.id, 'opmerkingen')}
                        onSave={(value) => handleCellSave(order.id, 'opmerkingen', value)}
                        onCancel={handleCellCancel}
                        placeholder="-"
                        className="px-6 py-4 text-sm text-gray-500 max-w-xs"
                        multiline
                      />
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

