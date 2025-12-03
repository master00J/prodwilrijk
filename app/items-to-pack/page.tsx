'use client'

import { useState, useEffect, useMemo } from 'react'
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

export default function ItemsToPackPage() {
  const [items, setItems] = useState<ItemToPack[]>([])
  const [loading, setLoading] = useState(true)
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
  const [activeTimeLogs, setActiveTimeLogs] = useState<any[]>([])
  const [selectedItemForAction, setSelectedItemForAction] = useState<number | null>(null)
  const [sortColumn, setSortColumn] = useState<keyof ItemToPack | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch items
  useEffect(() => {
    fetchItems()
    fetchActiveTimeLogs()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchItems()
      fetchActiveTimeLogs()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items-to-pack')
      if (!response.ok) throw new Error('Failed to fetch items')
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

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
        const itemDate = new Date(item.date_added).toISOString().split('T')[0]
        return itemDate === dateFilter
      })
    }

    // Apply priority filter
    if (priorityOnly) {
      filtered = filtered.filter(item => item.priority)
    }

    // Apply measurement filter
    if (measurementOnly) {
      filtered = filtered.filter(item => item.measurement)
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
  }, [items, searchTerm, dateFilter, priorityOnly, measurementOnly, sortColumn, sortDirection])

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
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
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

  const fetchActiveTimeLogs = async () => {
    try {
      const response = await fetch('/api/time-logs/active')
      if (!response.ok) throw new Error('Failed to fetch active time logs')
      const data = await response.json()
      setActiveTimeLogs(data)
    } catch (error) {
      console.error('Error fetching active time logs:', error)
    }
  }

  const handleStartTimer = async (employeeIds: number[]) => {
    try {
      const response = await fetch('/api/time-logs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds, type: 'items_to_pack' }),
      })

      if (!response.ok) throw new Error('Failed to start timer')

      await fetchActiveTimeLogs()
      setShowTimeModal(false)
      alert('Time registration started successfully')
    } catch (error) {
      console.error('Error starting timer:', error)
      alert('Failed to start time registration')
    }
  }

  const handleStopTimer = async (logId: number, employeeName?: string) => {
    const employeeText = employeeName ? ` for ${employeeName}` : ''
    if (!confirm(`Are you sure you want to stop the time registration${employeeText}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/time-logs/${logId}/stop`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to stop timer')

      await fetchActiveTimeLogs()
      alert(`Time registration${employeeText} stopped successfully`)
    } catch (error) {
      console.error('Error stopping timer:', error)
      alert('Failed to stop time registration')
    }
  }

  const handleStopAllTimers = async () => {
    if (activeTimeLogs.length === 0) return

    if (!confirm(`Stop all ${activeTimeLogs.length} active time registration(s)?`)) {
      return
    }

    try {
      const promises = activeTimeLogs.map((log) =>
        fetch(`/api/time-logs/${log.id}/stop`, { method: 'POST' })
      )

      await Promise.all(promises)
      await fetchActiveTimeLogs()
      alert('All time registrations stopped successfully')
    } catch (error) {
      console.error('Error stopping all timers:', error)
      alert('Failed to stop all time registrations')
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
        onSearchChange={setSearchTerm}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        priorityOnly={priorityOnly}
        onPriorityToggle={() => setPriorityOnly(!priorityOnly)}
        measurementOnly={measurementOnly}
        onMeasurementToggle={() => setMeasurementOnly(!measurementOnly)}
        onShowReport={() => setShowReport(true)}
      />

      <ActionsBar
        selectedCount={selectedItems.size}
        totalCount={filteredAndSortedItems.length}
        onMarkAsPacked={handleMarkAsPacked}
        onSetPriority={handleSetPriority}
        onSetMeasurement={handleSetMeasurement}
        onDeleteSelected={handleDeleteSelected}
        onShowScanner={() => setShowScanner(true)}
        onShowTimer={() => setShowTimeModal(true)}
        activeTimerCount={activeTimeLogs.length}
      />

      <ItemsTable
        items={filteredAndSortedItems}
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
      />

      {showScanner && (
        <BarcodeScanner
          items={filteredAndSortedItems}
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
    </div>
  )
}

