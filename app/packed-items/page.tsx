'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import PackedItemsTable from '@/components/packed-items/PackedItemsTable'
import PackedItemsFilters from '@/components/packed-items/PackedItemsFilters'
import PackedItemsStats from '@/components/packed-items/PackedItemsStats'

interface PackedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  date_packed: string
  original_id?: number
}

interface PackedItemsResponse {
  items: PackedItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function PackedItemsPage() {
  const [items, setItems] = useState<PackedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100) // Items per page
  const [totalPages, setTotalPages] = useState(0)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showOverdue, setShowOverdue] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalPacked: 0,
    averagePerDay: 0,
    averageStayDuration: 0,
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (showOverdue) params.append('show_overdue', 'true')

      const response = await fetch(`/api/packed-items?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')

      const data: PackedItemsResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching packed items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, dateFrom, dateTo, showOverdue])

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`/api/packed-items/stats?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchItems()
    fetchStats()
  }, [fetchItems, fetchStats])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page on new search
  }

  const handleDateFilter = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setCurrentPage(1) // Reset to first page on new filter
  }

  const handleOverdueToggle = () => {
    setShowOverdue(!showOverdue)
    setCurrentPage(1) // Reset to first page
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // Create CSV content
    const headers = ['ID', 'Item Number', 'Pallet Number', 'Amount', 'Date Added', 'Date Packed']
    const rows = items.map(item => [
      item.id,
      item.item_number,
      item.po_number,
      item.amount,
      new Date(item.date_added).toLocaleDateString(),
      new Date(item.date_packed).toLocaleDateString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `packed_items_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Packed Items</h1>

      <PackedItemsFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFilterChange={handleDateFilter}
        showOverdue={showOverdue}
        onOverdueToggle={handleOverdueToggle}
      />

      <PackedItemsStats stats={stats} />

      <PackedItemsTable
        items={items}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        onPageChange={handlePageChange}
        onPrint={handlePrint}
        onDownload={handleDownload}
      />
    </div>
  )
}

