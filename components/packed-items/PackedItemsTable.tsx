'use client'

import { useMemo } from 'react'

interface PackedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  date_added: string
  date_packed: string
}

interface PackedItemsTableProps {
  items: PackedItem[]
  loading: boolean
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onPrint: () => void
  onDownload: () => void
  onSendEmail?: () => void
}

export default function PackedItemsTable({
  items,
  loading,
  currentPage,
  totalPages,
  total,
  onPageChange,
  onPrint,
  onDownload,
  onSendEmail,
}: PackedItemsTableProps) {
  const paginationButtons = useMemo(() => {
    const buttons = []
    const maxButtons = 7
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
    let endPage = Math.min(totalPages, startPage + maxButtons - 1)

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1)
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key="first"
          onClick={() => onPageChange(1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          «
        </button>
      )
    }

    if (currentPage > 1) {
      buttons.push(
        <button
          key="prev"
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          ‹
        </button>
      )
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`px-4 py-2 border rounded-lg ${
            i === currentPage
              ? 'bg-blue-500 text-white border-blue-500'
              : 'border-gray-300 hover:bg-gray-100'
          }`}
        >
          {i}
        </button>
      )
    }

    if (currentPage < totalPages) {
      buttons.push(
        <button
          key="next"
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          ›
        </button>
      )
    }

    if (endPage < totalPages) {
      buttons.push(
        <button
          key="last"
          onClick={() => onPageChange(totalPages)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          »
        </button>
      )
    }

    return buttons
  }, [currentPage, totalPages, onPageChange])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Action Buttons */}
      <div className="p-4 border-b flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {items.length > 0 ? (currentPage - 1) * 100 + 1 : 0} -{' '}
          {Math.min(currentPage * 100, total)} of {total} items
        </div>
        <div className="flex gap-2">
          {onSendEmail && (
            <button
              onClick={onSendEmail}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium no-print"
            >
              📧 Send Email
            </button>
          )}
          <button
            onClick={onPrint}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium no-print"
          >
            🖨️ Print
          </button>
          <button
            onClick={onDownload}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium no-print"
          >
            ⬇️ Download Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Item Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Pallet Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date Added
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date Packed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const dateAdded = new Date(item.date_added)
                const datePacked = new Date(item.date_packed)
                const stayDuration = Math.ceil(
                  (datePacked.getTime() - dateAdded.getTime()) / (1000 * 60 * 60 * 24)
                )

                return (
                  <tr
                    key={item.id}
                    className={stayDuration > 7 ? 'bg-yellow-50' : undefined}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.item_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.po_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.amount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {dateAdded.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {datePacked.toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t flex justify-center items-center gap-2 flex-wrap no-print">
          {paginationButtons}
        </div>
      )}
    </div>
  )
}



