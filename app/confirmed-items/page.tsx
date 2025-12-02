'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ConfirmedIncomingGood } from '@/types/database'

export default function ConfirmedItemsPage() {
  const [items, setItems] = useState<ConfirmedIncomingGood[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof ConfirmedIncomingGood | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/confirmed-incoming-goods')
      if (!response.ok) throw new Error('Failed to fetch items')
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching confirmed items:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchItems, 30000)
    return () => clearInterval(interval)
  }, [fetchItems])

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items]

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(
        item =>
          item.item_number?.toLowerCase().includes(search) ||
          item.po_number?.toLowerCase().includes(search) ||
          item.id.toString().includes(search)
      )
    }

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date_confirmed).toISOString().split('T')[0]
        return itemDate === dateFilter
      })
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortColumn]
        let bVal: any = b[sortColumn]

        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1

        if (sortColumn === 'date_confirmed' || sortColumn === 'date_added') {
          aVal = new Date(aVal as string).getTime()
          bVal = new Date(bVal as string).getTime()
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = (bVal as string).toLowerCase()
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [items, searchTerm, dateFilter, sortColumn, sortDirection])

  const handleSort = (column: keyof ConfirmedIncomingGood) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const totalAmount = useMemo(() => {
    return filteredAndSortedItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [filteredAndSortedItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Confirmed Incoming Items</h1>
      <p className="text-gray-600 mb-6">
        Use this list to mark items in the WMS system. Items will appear in Items to Pack after WMS Status 30 import.
      </p>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by item number or pallet number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            )}
            <div className="text-lg font-medium">
              Total Amount: <span className="font-bold text-blue-600">{totalAmount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('id')}
                >
                  ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('item_number')}
                >
                  Item Number {sortColumn === 'item_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('po_number')}
                >
                  Pallet Number {sortColumn === 'po_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date_confirmed')}
                >
                  Date Confirmed {sortColumn === 'date_confirmed' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No confirmed items found
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.id}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {item.item_number}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.po_number}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.amount}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {new Date(item.date_confirmed).toLocaleString()}
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

