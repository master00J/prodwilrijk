'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ConfirmedIncomingGood } from '@/types/database'
import Pagination from '@/components/common/Pagination'

interface ConfirmedItemsResponse {
  items: ConfirmedIncomingGood[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ConfirmedItemsPage() {
  const [items, setItems] = useState<ConfirmedIncomingGood[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortColumn, setSortColumn] = useState<keyof ConfirmedIncomingGood | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (dateFilter) params.append('date', dateFilter)

      const response = await fetch(`/api/confirmed-incoming-goods?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')
      const data: ConfirmedItemsResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching confirmed items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, dateFilter])

  useEffect(() => {
    fetchItems()
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchItems()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchItems])

  // Sort items (filtering is now done server-side)
  const sortedItems = useMemo(() => {
    if (!sortColumn) return items

    const sorted = [...items]
    sorted.sort((a, b) => {
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

    return sorted
  }, [items, sortColumn, sortDirection])

  const handleSort = (column: keyof ConfirmedIncomingGood) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(sortedItems.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value)
    setCurrentPage(1)
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to delete')
      return
    }

    const count = selectedItems.size
    if (!confirm(`Are you sure you want to delete ${count} item(s)? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/confirmed-incoming-goods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (!response.ok) throw new Error('Failed to delete items')

      await fetchItems()
      setSelectedItems(new Set())
      alert(`${count} item(s) deleted successfully`)
    } catch (error) {
      console.error('Error deleting items:', error)
      alert('Failed to delete items')
    }
  }

  const totalAmount = useMemo(() => {
    return sortedItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [sortedItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Confirmed Incoming Items</h1>
      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
        Use this list to mark items in the WMS system. Items will appear in Items to Pack after WMS Status 30 import.
      </p>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by item number or pallet number..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            {dateFilter && (
              <button
                onClick={() => handleDateFilterChange('')}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            )}
            <div className="text-lg font-medium">
              Total Amount: <span className="font-bold text-blue-600">{totalAmount}</span>
            </div>
            {selectedItems.size > 0 && (
              <div className="text-lg font-medium text-green-600">
                Selected: {selectedItems.size}
              </div>
            )}
            <button
              onClick={handleDeleteSelected}
              disabled={selectedItems.size === 0}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
            >
              🗑️ Delete Selected
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={sortedItems.length > 0 && sortedItems.every(item => selectedItems.has(item.id))}
                    ref={(input) => {
                      if (input) {
                        const someSelected = sortedItems.some(item => selectedItems.has(item.id))
                        input.indeterminate = someSelected && !sortedItems.every(item => selectedItems.has(item.id))
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-5 h-5 cursor-pointer"
                  />
                </th>
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
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No confirmed items found
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                        className="w-5 h-5 cursor-pointer"
                      />
                    </td>
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

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
          <div className="text-center text-sm text-gray-600 mt-2">
            Showing {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(currentPage * pageSize, total)} of {total} items
          </div>
        </div>
      )}
    </div>
  )
}


