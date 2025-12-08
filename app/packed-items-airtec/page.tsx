'use client'

import { useState, useEffect, useCallback } from 'react'
import { PackedItemAirtec } from '@/types/database'
import PackedItemsTableAirtec from '@/components/packed-items-airtec/PackedItemsTableAirtec'
import PackedItemsFiltersAirtec from '@/components/packed-items-airtec/PackedItemsFiltersAirtec'
import Pagination from '@/components/common/Pagination'

interface PackedItemsAirtecResponse {
  items: PackedItemAirtec[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function PackedItemsAirtecPage() {
  const [items, setItems] = useState<PackedItemAirtec[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [totalPages, setTotalPages] = useState(0)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [kistnummerFilter, setKistnummerFilter] = useState('')

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
      if (kistnummerFilter) params.append('kistnummer', kistnummerFilter)

      const response = await fetch(`/api/packed-items-airtec?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')

      const data: PackedItemsAirtecResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching packed items airtec:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, dateFrom, dateTo, kistnummerFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleDateFilter = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setCurrentPage(1)
  }

  const handleKistnummerFilterChange = (value: string) => {
    setKistnummerFilter(value)
    setCurrentPage(1)
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
    const headers = ['ID', 'Description', 'Item Number', 'Lot Number', 'Date Sent', 'Box Number', 'Division', 'Quantity', 'Date Received', 'Date Packed']
    const rows = items.map(item => [
      item.id,
      item.beschrijving || '',
      item.item_number || '',
      item.lot_number || '',
      item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '',
      item.kistnummer || '',
      item.divisie || '',
      item.quantity,
      new Date(item.datum_ontvangen).toLocaleDateString(),
      new Date(item.date_packed).toLocaleDateString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `packed_items_airtec_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Packed Items - Airtec</h1>

      <PackedItemsFiltersAirtec
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFilterChange={handleDateFilter}
        kistnummerFilter={kistnummerFilter}
        onKistnummerFilterChange={handleKistnummerFilterChange}
      />

      <PackedItemsTableAirtec
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

