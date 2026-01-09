'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ItemToPack } from '@/types/database'
import ItemsTable from '@/components/items-to-pack/ItemsTable'
import StatsBanner from '@/components/items-to-pack/StatsBanner'
import FiltersBar from '@/components/items-to-pack/FiltersBar'
import ActionsBar from '@/components/items-to-pack/ActionsBar'
import BarcodeScanner from '@/components/items-to-pack/BarcodeScanner'
import DailyReportModal from '@/components/items-to-pack/DailyReportModal'
import ReturnItemModal from '@/components/items-to-pack/ReturnItemModal'
import ImageUploadModal from '@/components/items-to-pack/ImageUploadModal'
import TimeRegistrationModal from '@/components/items-to-pack/TimeRegistrationModal'
import ActiveTimersCard from '@/components/items-to-pack/ActiveTimersCard'
import ProblemCommentModal from '@/components/items-to-pack/ProblemCommentModal'
import Pagination from '@/components/common/Pagination'

interface ItemsResponse {
  items: ItemToPack[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ItemsToPackPage() {
  const [items, setItems] = useState<ItemToPack[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [measurementOnly, setMeasurementOnly] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [showScanner, setShowScanner] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showProblemCommentModal, setShowProblemCommentModal] = useState(false)
  const [activeTimeLogs, setActiveTimeLogs] = useState<any[]>([])
  const [selectedItemForAction, setSelectedItemForAction] = useState<number | null>(null)
  const [sortColumn, setSortColumn] = useState<keyof ItemToPack | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (dateFilter) params.append('date', dateFilter)
      if (priorityOnly) params.append('priority', 'true')
      if (measurementOnly) params.append('measurement', 'true')

      const response = await fetch(`/api/items-to-pack?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')
      const data: ItemsResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, dateFilter, priorityOnly, measurementOnly])

  useEffect(() => {
    fetchItems()
    fetchActiveTimeLogs()
    // Auto-refresh every 60 seconds (reduced from 30 to improve performance)
    // Only refresh if page is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchItems()
        fetchActiveTimeLogs()
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

    return sorted
  }, [items, sortColumn, sortDirection])

  const handleSort = (column: keyof ItemToPack) => {
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
    setCurrentPage(1) // Reset to first page on new search
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value)
    setCurrentPage(1) // Reset to first page on new filter
  }

  const handlePriorityToggle = () => {
    setPriorityOnly(!priorityOnly)
    setCurrentPage(1) // Reset to first page
  }

  const handleMeasurementToggle = () => {
    setMeasurementOnly(!measurementOnly)
    setCurrentPage(1) // Reset to first page
  }

  const handleMarkAsPacked = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to pack')
      return
    }

    // Check if any selected items have problem status
    const selectedItemsArray = items.filter(item => selectedItems.has(item.id))
    const problemItems = selectedItemsArray.filter(item => item.problem)
    
    if (problemItems.length > 0) {
      alert(`Cannot pack items with problem status. Please remove problem status first.\n\nProblem items: ${problemItems.map(i => i.item_number).join(', ')}`)
      return
    }

    if (!confirm(`Mark ${selectedItems.size} item(s) as packed?`)) {
      return
    }

    try {
      const response = await fetch('/api/items-to-pack', {
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
      const response = await fetch('/api/items-to-pack/priority', {
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

  const handleSetMeasurement = async () => {
    const measurementItems = Array.from(selectedItems)
    if (measurementItems.length === 0) {
      alert('Please select items to set measurement')
      return
    }

    try {
      const response = await fetch('/api/items-to-pack/measurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: measurementItems }),
      })

      if (!response.ok) throw new Error('Failed to set measurement')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Measurement set successfully')
    } catch (error) {
      console.error('Error setting measurement:', error)
      alert('Failed to set measurement')
    }
  }

  const handleSetProblem = async () => {
    const problemItems = Array.from(selectedItems)
    if (problemItems.length === 0) {
      alert('Please select items to mark as problem')
      return
    }

    if (!confirm(`Mark ${problemItems.length} item(s) as having a problem? These items cannot be packed until the problem is resolved.`)) {
      return
    }

    try {
      const response = await fetch('/api/items-to-pack/problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: problemItems, problem: true }),
      })

      if (!response.ok) throw new Error('Failed to set problem status')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Items marked as problem successfully')
    } catch (error) {
      console.error('Error setting problem status:', error)
      alert('Failed to set problem status')
    }
  }

  const handleRemoveProblem = async () => {
    const problemItems = Array.from(selectedItems)
    if (problemItems.length === 0) {
      alert('Please select items to remove problem status')
      return
    }

    if (!confirm(`Remove problem status from ${problemItems.length} item(s)?`)) {
      return
    }

    try {
      const response = await fetch('/api/items-to-pack/problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: problemItems, problem: false }),
      })

      if (!response.ok) throw new Error('Failed to remove problem status')

      await fetchItems()
      setSelectedItems(new Set())
      alert('Problem status removed successfully')
    } catch (error) {
      console.error('Error removing problem status:', error)
      alert('Failed to remove problem status')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      const response = await fetch(`/api/items-to-pack/${id}`, {
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
      const response = await fetch('/api/items-to-pack', {
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

  const handleReturn = (id: number) => {
    setSelectedItemForAction(id)
    setShowReturnModal(true)
  }

  const handleReturnConfirm = async (reason: string, imageFiles: File[]) => {
    if (!selectedItemForAction) return

    try {
      // First upload images if any
      let imageUrls: string[] = []
      if (imageFiles.length > 0) {
        const formData = new FormData()
        imageFiles.forEach((file) => {
          formData.append('images', file)
        })
        formData.append('itemId', selectedItemForAction.toString())
        formData.append('itemType', 'returned_items')

        const imageResponse = await fetch('/api/items-to-pack/upload-image', {
          method: 'POST',
          body: formData,
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          imageUrls = imageData.urls || []
        }
      }

      // Then return the item
      const response = await fetch('/api/items-to-pack/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedItemForAction, 
          reason,
          imageUrls,
        }),
      })

      if (!response.ok) throw new Error('Failed to return item')

      await fetchItems()
      setShowReturnModal(false)
      setSelectedItemForAction(null)
      alert('Item returned successfully')
    } catch (error) {
      console.error('Error returning item:', error)
      alert('Failed to return item')
    }
  }

  const handleUploadImage = (id: number) => {
    setSelectedItemForAction(id)
    setShowImageUploadModal(true)
  }

  const handleImageUploaded = async () => {
    await fetchItems()
    setShowImageUploadModal(false)
    setSelectedItemForAction(null)
  }

  const handleEditProblemComment = (id: number) => {
    setSelectedItemForAction(id)
    setShowProblemCommentModal(true)
  }

  const handleSaveProblemComment = async (comment: string) => {
    if (!selectedItemForAction) return

    try {
      const response = await fetch('/api/items-to-pack/problem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedItemForAction,
          problem_comment: comment,
        }),
      })

      if (!response.ok) throw new Error('Failed to save problem comment')

      await fetchItems()
      setShowProblemCommentModal(false)
      setSelectedItemForAction(null)
      alert('Problem comment saved successfully')
    } catch (error) {
      console.error('Error saving problem comment:', error)
      alert('Failed to save problem comment')
    }
  }

  const fetchActiveTimeLogs = async () => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/time-logs/active?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch active time logs:', response.status, errorData)
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch active time logs`)
      }
      
      const data = await response.json()
      console.log('Fetched active time logs:', data)
      console.log('Number of active logs:', data?.length || 0)
      
      if (Array.isArray(data)) {
        setActiveTimeLogs(data)
      } else {
        console.warn('Expected array but got:', typeof data, data)
        setActiveTimeLogs([])
      }
    } catch (error) {
      console.error('Error fetching active time logs:', error)
      // Don't clear on error - keep existing data to avoid flickering
      // Only clear if it's a clear error that indicates no data
      if (error instanceof Error && error.message.includes('404')) {
        setActiveTimeLogs([])
      }
    }
  }

  const handleStartTimer = async (employeeIds: number[]) => {
    try {
      const response = await fetch('/api/time-logs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds, type: 'items_to_pack' }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to start timer'
        
        // If there are active logs, refresh the list and show a helpful message
        if (errorMessage.includes('already have active time logs')) {
          // Refresh active logs to show them
          await fetchActiveTimeLogs()
          
          // Show helpful message with option to view/stop existing timers
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
      
      // Wait a bit to ensure database is updated, then refresh
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 300)
      
      // Also refresh after a longer delay to be sure
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

    // Optimistically remove from UI immediately
    setActiveTimeLogs(prev => prev.filter(log => log.id !== logId))

    try {
      const response = await fetch(`/api/time-logs/${logId}/stop`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // If it failed, refresh to get correct state
        await fetchActiveTimeLogs()
        throw new Error(errorData.error || 'Failed to stop timer')
      }

      // Wait a bit to ensure database is updated, then refresh to be sure
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 200)
      
      // Also refresh after longer delay
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 1000)
      
      // Show success message
      alert(`Time registration${employeeText} stopped successfully`)
    } catch (error: any) {
      console.error('Error stopping timer:', error)
      // Refresh to get correct state
      await fetchActiveTimeLogs()
      
      // Check if timer was already stopped
      if (error.message?.includes('not found') || error.message?.includes('Active time log') || error.message?.includes('already stopped')) {
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

    // Optimistically clear all timers from UI immediately
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
      
      // Wait a bit to ensure database is updated, then refresh
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 200)
      
      // Also refresh after longer delay
      setTimeout(async () => {
        await fetchActiveTimeLogs()
      }, 1000)
      
      alert('All time registrations stopped successfully')
    } catch (error) {
      console.error('Error stopping all timers:', error)
      // Refresh anyway to get current state
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
      <h1 className="text-3xl font-bold mb-6">Items to Pack</h1>

      <StatsBanner items={items} />

      {activeTimeLogs.length > 0 && (
        <ActiveTimersCard
          timeLogs={activeTimeLogs}
          onStop={handleStopTimer}
          onStopAll={handleStopAllTimers}
        />
      )}

      <FiltersBar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        priorityOnly={priorityOnly}
        onPriorityToggle={handlePriorityToggle}
        measurementOnly={measurementOnly}
        onMeasurementToggle={handleMeasurementToggle}
        onShowReport={() => setShowReport(true)}
      />

      <ActionsBar
        selectedCount={selectedItems.size}
        totalCount={total}
        onMarkAsPacked={handleMarkAsPacked}
        onSetPriority={handleSetPriority}
        onSetMeasurement={handleSetMeasurement}
        onSetProblem={handleSetProblem}
        onRemoveProblem={handleRemoveProblem}
        onDeleteSelected={handleDeleteSelected}
        onShowScanner={() => setShowScanner(true)}
        onShowTimer={() => setShowTimeModal(true)}
        activeTimerCount={activeTimeLogs.length}
      />

      <ItemsTable
        items={sortedItems}
        selectedItems={selectedItems}
        onSelectItem={handleSelectItem}
        onSelectAll={handleSelectAll}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={fetchItems}
        onDelete={handleDelete}
        onReturn={handleReturn}
        onUploadImage={handleUploadImage}
        onEditProblemComment={handleEditProblemComment}
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

      {showScanner && (
        <BarcodeScanner
          items={sortedItems}
          onClose={() => setShowScanner(false)}
          onItemsScanned={async (scannedIds) => {
            setSelectedItems(new Set(scannedIds))
            setShowScanner(false)
          }}
        />
      )}

      {showReport && (
        <DailyReportModal
          onClose={() => setShowReport(false)}
        />
      )}

      {showReturnModal && selectedItemForAction && (
        <ReturnItemModal
          itemId={selectedItemForAction}
          item={items.find(item => item.id === selectedItemForAction)}
          onClose={() => {
            setShowReturnModal(false)
            setSelectedItemForAction(null)
          }}
          onConfirm={handleReturnConfirm}
        />
      )}

      {showImageUploadModal && selectedItemForAction && (
        <ImageUploadModal
          itemId={selectedItemForAction}
          itemType="items_to_pack"
          onClose={() => {
            setShowImageUploadModal(false)
            setSelectedItemForAction(null)
          }}
          onUploaded={handleImageUploaded}
        />
      )}

      {showTimeModal && (
        <TimeRegistrationModal
          onClose={() => setShowTimeModal(false)}
          onStart={handleStartTimer}
        />
      )}

      {showProblemCommentModal && selectedItemForAction && (
        <ProblemCommentModal
          itemId={selectedItemForAction}
          item={items.find(item => item.id === selectedItemForAction)}
          onClose={() => {
            setShowProblemCommentModal(false)
            setSelectedItemForAction(null)
          }}
          onSave={handleSaveProblemComment}
        />
      )}
    </div>
  )
}

