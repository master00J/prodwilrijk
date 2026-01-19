'use client'

import { useState, useEffect } from 'react'
import { WoodStock } from '@/types/database'

export default function WoodPickingPage() {
  const [stock, setStock] = useState<WoodStock[]>([])
  const [pickedItems, setPickedItems] = useState<WoodStock[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof WoodStock | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pickAmount, setPickAmount] = useState<{ [key: number]: number }>({})

  const fetchStock = async () => {
    try {
      const url = searchTerm 
        ? `/api/wood/stock?search=${encodeURIComponent(searchTerm)}`
        : '/api/wood/stock'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch stock')
      const data = await response.json()
      setStock(data)
    } catch (error) {
      console.error('Error fetching stock:', error)
      alert('Failed to load stock')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStock()
  }, [searchTerm])

  const handleSort = (column: keyof WoodStock) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedStock = [...stock].sort((a, b) => {
    if (!sortColumn) return 0
    
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr)
    } else {
      return bStr.localeCompare(aStr)
    }
  })

  const handlePick = async (stockItem: WoodStock) => {
    const amount = pickAmount[stockItem.id] || stockItem.aantal
    
    if (amount <= 0 || amount > stockItem.aantal) {
      alert('Invalid amount')
      return
    }

    if (!confirm(`Pick ${amount} planks from this stock item?`)) return

    try {
      const response = await fetch('/api/wood/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: stockItem.id,
          aantal: amount,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to pick wood')
      }

      alert('Wood picked successfully!')
      setPickAmount({ ...pickAmount, [stockItem.id]: 0 })
      await fetchStock()
    } catch (error) {
      console.error('Error picking wood:', error)
      alert(error instanceof Error ? error.message : 'Failed to pick wood')
    }
  }

  const handleUpdateStock = async (id: number, field: keyof WoodStock, value: string | number) => {
    try {
      const response = await fetch('/api/wood/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          [field]: value,
        }),
      })

      if (!response.ok) throw new Error('Failed to update stock')
      await fetchStock()
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Failed to update stock')
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Wood Picking</h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Zoek op soort, locatie, pakketnummer of 38x150x4500..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('houtsoort')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Wood Type {sortColumn === 'houtsoort' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('pakketnummer')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Package # {sortColumn === 'pakketnummer' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('dikte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Thickness (mm) {sortColumn === 'dikte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('breedte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Width (mm) {sortColumn === 'breedte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('lengte')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Length (mm) {sortColumn === 'lengte' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('locatie')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Location {sortColumn === 'locatie' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('aantal')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Amount {sortColumn === 'aantal' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No stock found
                  </td>
                </tr>
              ) : (
                sortedStock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.houtsoort}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.pakketnummer || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dikte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.breedte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.lengte}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.locatie}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.aantal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={item.aantal}
                          value={pickAmount[item.id] || item.aantal}
                          onChange={(e) => setPickAmount({ ...pickAmount, [item.id]: parseInt(e.target.value) || item.aantal })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => handlePick(item)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          Pick
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



