'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { IncomingGoodAirtec } from '@/types/database'
import ViewAirtecTable from '@/components/view-airtec/ViewAirtecTable'
import ViewAirtecFilters from '@/components/view-airtec/ViewAirtecFilters'
import AddItemForm from '@/components/view-airtec/AddItemForm'
import Pagination from '@/components/common/Pagination'

interface IncomingGoodsAirtecResponse {
  items: IncomingGoodAirtec[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ViewAirtecPage() {
  const [items, setItems] = useState<IncomingGoodAirtec[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortColumn, setSortColumn] = useState<keyof IncomingGoodAirtec | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/incoming-goods-airtec?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')
      const data: IncomingGoodsAirtecResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching incoming goods airtec:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm])

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

      if (sortColumn === 'datum_ontvangen' || sortColumn === 'datum_opgestuurd') {
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

  const handleSort = (column: keyof IncomingGoodAirtec) => {
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

  const handleConfirm = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to confirm')
      return
    }

    if (!confirm(`Confirm ${selectedItems.size} item(s)? These items will appear in Items to Pack Airtec.`)) {
      return
    }

    try {
      const response = await fetch('/api/incoming-goods-airtec/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (!response.ok) throw new Error('Failed to confirm items')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Items confirmed successfully. They will appear in Items to Pack Airtec.')
    } catch (error) {
      console.error('Error confirming items:', error)
      alert('Failed to confirm items')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      const response = await fetch(`/api/incoming-goods-airtec/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete item')

      await fetchItems()
      alert('Item deleted successfully')
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    }
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
      const response = await fetch('/api/incoming-goods-airtec', {
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

  const totalQuantity = useMemo(() => {
    return sortedItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
  }, [sortedItems])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">View Airtec - Incoming Goods</h1>

      <ViewAirtecFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedItems.size}
        totalQuantity={totalQuantity}
        onConfirm={handleConfirm}
        onDeleteSelected={handleDeleteSelected}
      />

      <ViewAirtecTable
        items={sortedItems}
        selectedItems={selectedItems}
        onSelectItem={handleSelectItem}
        onSelectAll={handleSelectAll}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onDelete={handleDelete}
        loading={loading}
      />

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

      <AddItemForm onItemAdded={fetchItems} />
    </div>
  )
}

