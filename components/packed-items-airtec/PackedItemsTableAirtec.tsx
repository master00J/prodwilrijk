'use client'

import { useMemo } from 'react'
import { PackedItemAirtec } from '@/types/database'
import Pagination from '@/components/common/Pagination'

interface PackedItemsTableAirtecProps {
  items: PackedItemAirtec[]
  loading: boolean
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onPrint: () => void
  onDownload: () => void
  onSendEmail?: () => void
  onShowReport?: () => void
}

export default function PackedItemsTableAirtec({
  items,
  loading,
  currentPage,
  totalPages,
  total,
  onPageChange,
  onPrint,
  onDownload,
  onSendEmail,
  onShowReport,
}: PackedItemsTableAirtecProps) {
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
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium no-print"
            >
              📧 Send Email
            </button>
          )}
          {onShowReport && (
            <button
              onClick={onShowReport}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium no-print"
            >
              📊 Box Report
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
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Item Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Lot Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date Sent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Box Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Division
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date Received
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date Packed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.beschrijving || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.item_number || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.lot_number || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.kistnummer || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.divisie || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.datum_ontvangen).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.date_packed).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t no-print">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}

