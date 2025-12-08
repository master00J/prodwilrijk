'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { PackedItemAirtec } from '@/types/database'
import PackedItemsTableAirtec from '@/components/packed-items-airtec/PackedItemsTableAirtec'
import PackedItemsFiltersAirtec from '@/components/packed-items-airtec/PackedItemsFiltersAirtec'
import EmailModal from '@/components/packed-items/EmailModal'
import BoxReportModal from '@/components/packed-items-airtec/BoxReportModal'
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
  
  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  
  // Box report modal
  const [showBoxReportModal, setShowBoxReportModal] = useState(false)

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
    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(
      items.map(item => ({
        'ID': item.id,
        'Description': item.beschrijving || '',
        'Item Number': item.item_number || '',
        'Lot Number': item.lot_number || '',
        'Date Sent': item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '',
        'Box Number': item.kistnummer || '',
        'Division': item.divisie || '',
        'Quantity': item.quantity,
        'Date Received': new Date(item.datum_ontvangen).toLocaleDateString(),
        'Date Packed': new Date(item.date_packed).toLocaleDateString(),
      }))
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Packed Items Airtec')

    // Generate Excel file and download
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `packed_items_airtec_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
  }

  const handleSendEmail = async (email: string) => {
    const response = await fetch('/api/packed-items-airtec/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    return response.json()
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
        onSendEmail={() => setShowEmailModal(true)}
        onShowReport={() => setShowBoxReportModal(true)}
      />

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSend={handleSendEmail}
      />

      <BoxReportModal
        isOpen={showBoxReportModal}
        onClose={() => setShowBoxReportModal(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}

