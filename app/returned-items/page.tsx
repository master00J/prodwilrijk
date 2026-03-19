'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { ReturnedItem } from '@/types/database'
import ReturnedItemsTable from '@/components/returned-items/ReturnedItemsTable'
import ReturnedItemsFilters from '@/components/returned-items/ReturnedItemsFilters'

interface ReturnedItemsResponse {
  items: ReturnedItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ReturnedItemsPage() {
  const [items, setItems] = useState<ReturnedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [totalPages, setTotalPages] = useState(0)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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

      const response = await fetch(`/api/returned-items?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch items')

      const data: ReturnedItemsResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching returned items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, dateFrom, dateTo])

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDownload = () => {
    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(
      items.map(item => ({
        'ID': item.id,
        'Item Number': item.item_number,
        'Pallet Number': item.po_number,
        'Amount': item.amount,
        'Date Added': new Date(item.date_added).toLocaleDateString(),
        'Date Returned': new Date(item.date_returned).toLocaleDateString(),
        'Reason': item.reason || '',
      }))
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Returned Items')

    // Generate Excel file and download
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `returned_items_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Returned Items</h1>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
        >
          ⬇️ Download Excel
        </button>
      </div>

      <ReturnedItemsFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFilterChange={handleDateFilter}
      />

      <ReturnedItemsTable
        items={items}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        onPageChange={handlePageChange}
      />
    </div>
  )
}



