'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ItemToPackAirtec } from '@/types/database'
import ItemsTableAirtec from '@/components/items-to-pack-airtec/ItemsTableAirtec'
import FiltersBarAirtec from '@/components/items-to-pack-airtec/FiltersBarAirtec'
import ActionsBarAirtec from '@/components/items-to-pack-airtec/ActionsBarAirtec'
import TimeRegistrationModal from '@/components/items-to-pack/TimeRegistrationModal'
import ActiveTimersCard from '@/components/items-to-pack/ActiveTimersCard'
import Pagination from '@/components/common/Pagination'

interface ItemsAirtecResponse {
  items: ItemToPackAirtec[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ItemsToPackAirtecPage() {
  const [items, setItems] = useState<ItemToPackAirtec[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [kistnummerFilter, setKistnummerFilter] = useState('')
  const [debouncedKistnummerFilter, setDebouncedKistnummerFilter] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [activeTimeLogs, setActiveTimeLogs] = useState<any[]>([])
  const [sortColumn, setSortColumn] = useState<keyof ItemToPackAirtec | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (priorityOnly) params.append('priority', 'true')
      if (debouncedKistnummerFilter) params.append('kistnummer', debouncedKistnummerFilter)

      const response = await fetch(`/api/items-to-pack-airtec?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')
      const data: ItemsAirtecResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, debouncedSearchTerm, priorityOnly, debouncedKistnummerFilter])

  const fetchActiveTimeLogs = async () => {
    try {
      const response = await fetch(`/api/time-logs/active?type=items_to_pack_airtec&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch active time logs:', response.status, errorData)
        return
      }
      
      const data = await response.json()
      setActiveTimeLogs(data || [])
    } catch (error) {
      console.error('Error fetching active time logs:', error)
    }
  }

  useEffect(() => {
    fetchItems()
    fetchActiveTimeLogs()
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchItems()
        fetchActiveTimeLogs()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchItems])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedKistnummerFilter(kistnummerFilter)
    }, 300)
    return () => clearTimeout(timeout)
  }, [kistnummerFilter])

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

  const handleSort = (column: keyof ItemToPackAirtec) => {
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

  const handlePriorityToggle = () => {
    setPriorityOnly(!priorityOnly)
    setCurrentPage(1)
  }

  const handleKistnummerFilterChange = (value: string) => {
    setKistnummerFilter(value)
    setCurrentPage(1)
  }

  const handleMarkAsPacked = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to pack')
      return
    }

    if (!confirm(`Mark ${selectedItems.size} item(s) as packed?`)) {
      return
    }

    try {
      const response = await fetch('/api/items-to-pack-airtec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (!response.ok) throw new Error('Failed to mark items as packed')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Items marked as packed successfully')
    } catch (error) {
      console.error('Error marking items as packed:', error)
      alert('Failed to mark items as packed')
    }
  }

  const handleSetPriority = async () => {
    const priorityItems = Array.from(selectedItems)
    if (priorityItems.length === 0) {
      alert('Please select items to set priority')
      return
    }

    try {
      const response = await fetch('/api/items-to-pack-airtec/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: priorityItems }),
      })

      if (!response.ok) throw new Error('Failed to set priority')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Priority set successfully')
    } catch (error) {
      console.error('Error setting priority:', error)
      alert('Failed to set priority')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      const response = await fetch(`/api/items-to-pack-airtec/${id}`, {
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

    if (!confirm(`Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/items-to-pack-airtec', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (!response.ok) throw new Error('Failed to delete items')

      await fetchItems()
      setSelectedItems(new Set())
      alert(`${selectedItems.size} item(s) deleted successfully`)
    } catch (error) {
      console.error('Error deleting items:', error)
      alert('Failed to delete items')
    }
  }

  const handleStartTimer = async (employeeIds: number[]) => {
    try {
      const response = await fetch('/api/time-logs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds, type: 'items_to_pack_airtec' }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to start timer'
        
        if (errorMessage.includes('already have active time logs')) {
          await fetchActiveTimeLogs()
          const shouldContinue = confirm(
            `${errorMessage}\n\n` +
            `There are already active time registrations. ` +
            `Would you like to refresh the page to see them? ` +
            `(Click OK to refresh, Cancel to stay)`
          )
          
          if (shouldContinue) {
            window.location.reload()
          }
          return
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Timer start result:', result)
      
      setShowTimeModal(false)
      
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 300)
      
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 1000)
      
      alert('Time registration started successfully')
    } catch (error: any) {
      console.error('Error starting timer:', error)
      alert(`Failed to start time registration: ${error.message || 'Unknown error'}`)
    }
  }

  const handleStopTimer = async (logId: number, employeeName?: string) => {
    const employeeText = employeeName ? ` for ${employeeName}` : ''
    if (!confirm(`Are you sure you want to stop the time registration${employeeText}?`)) {
      return
    }

    setActiveTimeLogs(prev => prev.filter(log => log.id !== logId))

    try {
      const response = await fetch(`/api/time-logs/${logId}/stop`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        await fetchActiveTimeLogs()
        throw new Error(errorData.error || 'Failed to stop timer')
      }

      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 200)
      
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 1000)
      
      alert(`Time registration${employeeText} stopped successfully`)
    } catch (error: any) {
      console.error('Error stopping timer:', error)
      await fetchActiveTimeLogs()
      
      if (error.message?.includes('not found') || error.message?.includes('already stopped')) {
        alert('Timer was already stopped. List refreshed.')
      } else {
        alert(`Failed to stop time registration: ${error.message || 'Unknown error'}`)
      }
    }
  }

  const handleStopAllTimers = async () => {
    if (activeTimeLogs.length === 0) return

    if (!confirm(`Stop all ${activeTimeLogs.length} active time registration(s)?`)) {
      return
    }

    setActiveTimeLogs([])

    try {
      const promises = activeTimeLogs.map(async (log) => {
        const response = await fetch(`/api/time-logs/${log.id}/stop`, { method: 'POST' })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.warn(`Failed to stop timer ${log.id}:`, errorData.error || 'Unknown error')
        }
        return response
      })

      await Promise.all(promises)
      
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 200)
      
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 1000)
      
      alert('All time registrations stopped successfully')
    } catch (error) {
      console.error('Error stopping all timers:', error)
      await fetchActiveTimeLogs()
      alert('Some timers may have failed to stop. Refreshing list...')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Items to Pack - Airtec</h1>

      {activeTimeLogs.length > 0 && (
        <ActiveTimersCard
          timeLogs={activeTimeLogs}
          onStop={handleStopTimer}
          onStopAll={handleStopAllTimers}
        />
      )}

      <FiltersBarAirtec
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        priorityOnly={priorityOnly}
        onPriorityToggle={handlePriorityToggle}
        kistnummerFilter={kistnummerFilter}
        onKistnummerFilterChange={handleKistnummerFilterChange}
      />

      <ActionsBarAirtec
        selectedCount={selectedItems.size}
        totalCount={total}
        onMarkAsPacked={handleMarkAsPacked}
        onSetPriority={handleSetPriority}
        onDeleteSelected={handleDeleteSelected}
        onShowTimer={() => setShowTimeModal(true)}
        activeTimerCount={activeTimeLogs.length}
      />

      <ItemsTableAirtec
        items={sortedItems}
        selectedItems={selectedItems}
        onSelectItem={handleSelectItem}
        onSelectAll={handleSelectAll}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={fetchItems}
        onDelete={handleDelete}
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

      {showTimeModal && (
        <TimeRegistrationModal
          onClose={() => setShowTimeModal(false)}
          onStart={handleStartTimer}
        />
      )}
    </div>
  )
}

