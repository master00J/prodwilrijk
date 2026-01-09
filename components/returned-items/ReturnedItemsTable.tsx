'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ReturnedItem } from '@/types/database'
import Pagination from '@/components/common/Pagination'

interface ReturnedItemsTableProps {
  items: ReturnedItem[]
  loading: boolean
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export default function ReturnedItemsTable({
  items,
  loading,
  currentPage,
  totalPages,
  total,
  onPageChange,
}: ReturnedItemsTableProps) {
  const [expandedImageId, setExpandedImageId] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {items.length > 0 ? (currentPage - 1) * 100 + 1 : 0} -{' '}
          {Math.min(currentPage * 100, total)} of {total} items
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
                Date Returned
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Images
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No returned items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const dateAdded = new Date(item.date_added)
                const dateReturned = new Date(item.date_returned)

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
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
                      {dateReturned.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={item.reason || 'No reason provided'}>
                        {item.reason || <span className="text-gray-400 italic">No reason</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {item.images && item.images.length > 0 ? (
                        <div className="flex gap-2">
                          {item.images.slice(0, 3).map((imageUrl, idx) => (
                            <div
                              key={idx}
                              className="relative w-12 h-12 cursor-pointer"
                              onClick={() => setExpandedImageId(expandedImageId === item.id ? null : item.id)}
                            >
                              <Image
                                src={imageUrl}
                                alt={`Image ${idx + 1}`}
                                fill
                                className="object-cover rounded border border-gray-300"
                                unoptimized
                              />
                            </div>
                          ))}
                          {item.images.length > 3 && (
                            <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-300 text-xs text-gray-600">
                              +{item.images.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">No images</span>
                      )}
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
        <div className="p-4 border-t">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {/* Image Modal */}
      {expandedImageId !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImageId(null)}
        >
          <div className="max-w-4xl max-h-full relative">
            <button
              onClick={() => setExpandedImageId(null)}
              className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 z-10"
            >
              ×
            </button>
            {(() => {
              const item = items.find(i => i.id === expandedImageId)
              if (!item || !item.images || item.images.length === 0) return null
              
              return (
                <div className="grid grid-cols-2 gap-4">
                  {item.images.map((imageUrl, idx) => (
                    <div key={idx} className="relative w-full h-64">
                      <Image
                        src={imageUrl}
                        alt={`Image ${idx + 1}`}
                        fill
                        className="object-contain rounded"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

