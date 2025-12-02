'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { IncomingGood } from '@/types/database'
import ViewPrepackTable from '@/components/view-prepack/ViewPrepackTable'
import ViewPrepackFilters from '@/components/view-prepack/ViewPrepackFilters'
import AddItemForm from '@/components/view-prepack/AddItemForm'

export default function ViewPrepackPage() {
  const [items, setItems] = useState<IncomingGood[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortColumn, setSortColumn] = useState<keyof IncomingGood | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/incoming-goods')
      if (!response.ok) throw new Error('Failed to fetch items')
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching incoming goods:', error)
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

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortColumn]
        let bVal: any = b[sortColumn]

        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1

        if (sortColumn === 'date_added') {
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
  }, [items, searchTerm, sortColumn, sortDirection])

  const handleSort = (column: keyof IncomingGood) => {
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
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleConfirm = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to confirm')
      return
    }

    if (!confirm(`Confirm ${selectedItems.size} item(s)? These items will appear in Items to Pack after WMS Status 30 import.`)) {
      return
    }

    try {
      const response = await fetch('/api/incoming-goods/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (!response.ok) throw new Error('Failed to confirm items')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Items confirmed successfully. They will appear in Items to Pack after WMS Status 30 import.')
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
      const response = await fetch(`/api/incoming-goods/${id}`, {
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

  const totalAmount = useMemo(() => {
    return filteredAndSortedItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [filteredAndSortedItems])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">View Prepack - Incoming Goods</h1>

      <ViewPrepackFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCount={selectedItems.size}
        totalAmount={totalAmount}
        onConfirm={handleConfirm}
      />

      <ViewPrepackTable
        items={filteredAndSortedItems}
        selectedItems={selectedItems}
        onSelectItem={handleSelectItem}
        onSelectAll={handleSelectAll}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onDelete={handleDelete}
        loading={loading}
      />

      <AddItemForm onItemAdded={fetchItems} />
    </div>
  )
}

