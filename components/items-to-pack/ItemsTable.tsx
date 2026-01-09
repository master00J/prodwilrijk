'use client'

import { ItemToPack } from '@/types/database'
import { useState } from 'react'
import Image from 'next/image'

interface ItemsTableProps {
  items: ItemToPack[]
  selectedItems: Set<number>
  onSelectItem: (id: number, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  sortColumn: keyof ItemToPack | null
  sortDirection: 'asc' | 'desc'
  onSort: (column: keyof ItemToPack) => void
  onRefresh: () => void
  onDelete: (id: number) => void
  onReturn: (id: number) => void
  onUploadImage: (id: number) => void
  onEditProblemComment: (id: number) => void
}

export default function ItemsTable({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  onRefresh,
  onDelete,
  onReturn,
  onUploadImage,
  onEditProblemComment,
}: ItemsTableProps) {
  const [expandedImage, setExpandedImage] = useState<number | null>(null)

  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id))

  const handleImageClick = (itemId: number, imageUrl: string) => {
    if (expandedImage === itemId) {
      setExpandedImage(null)
    } else {
      setExpandedImage(itemId)
      window.open(imageUrl, '_blank')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-5 h-5 cursor-pointer"
                />
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('id')}
              >
                ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('item_number')}
              >
                Item Number {sortColumn === 'item_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('po_number')}
              >
                Pallet Number {sortColumn === 'po_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('amount')}
              >
                Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('date_added')}
              >
                Date Added {sortColumn === 'date_added' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">
                Priority
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">
                Measurement
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">
                Problem
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">
                Images
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isPriority = item.priority
                const isMeasurement = item.measurement
                const isProblem = item.problem
                
                // Problem items get red background, priority over other colors
                let rowClass = ''
                if (isProblem) {
                  rowClass = 'bg-red-100 border-l-4 border-red-500'
                } else if (isPriority && isMeasurement) {
                  rowClass = 'bg-gradient-to-r from-yellow-50 to-blue-50'
                } else if (isPriority) {
                  rowClass = 'bg-yellow-50'
                } else if (isMeasurement) {
                  rowClass = 'bg-blue-50'
                }

                return (
                  <tr key={item.id} className={rowClass || undefined}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => onSelectItem(item.id, e.target.checked)}
                        className="w-5 h-5 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.id}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                      {item.item_number}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.po_number}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.amount}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {new Date(item.date_added).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isPriority}
                        readOnly
                        className="w-5 h-5"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isMeasurement}
                        readOnly
                        className="w-5 h-5"
                      />
                    </td>
                    <td className="px-4 py-4">
                      {isProblem && (
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⚠️ Problem
                          </span>
                          <button
                            onClick={() => onEditProblemComment(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            title={item.problem_comment ? 'Edit problem comment' : 'Add problem comment'}
                          >
                            💬
                          </button>
                        </div>
                      )}
                      {isProblem && item.problem_comment && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-gray-700 max-w-xs">
                          <div className="font-medium text-red-800 mb-1">Comment:</div>
                          <div className="whitespace-pre-wrap">{item.problem_comment}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2 items-center flex-wrap">
                        <button
                          onClick={() => onUploadImage(item.id)}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          title="Upload image"
                        >
                          📷
                        </button>
                        {item.images && item.images.length > 0 ? (
                          <div className="flex gap-1">
                            {item.images.slice(0, 3).map((imgUrl, idx) => (
                              <div key={idx} className="relative w-12 h-12">
                                <Image
                                  src={imgUrl}
                                  alt={`Item ${idx + 1}`}
                                  fill
                                  className="object-cover rounded cursor-pointer hover:scale-150 transition-transform"
                                  onClick={() => handleImageClick(item.id, imgUrl)}
                                  unoptimized
                                />
                              </div>
                            ))}
                            {item.images.length > 3 && (
                              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">
                                +{item.images.length - 3}
                              </div>
                            )}
                          </div>
                        ) : item.image ? (
                          <div className="relative w-12 h-12">
                            <Image
                              src={item.image}
                              alt="Item"
                              fill
                              className="object-cover rounded cursor-pointer hover:scale-150 transition-transform"
                              onClick={() => item.image && handleImageClick(item.id, item.image!)}
                              unoptimized
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onReturn(item.id)}
                          className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 font-medium"
                          title="Return item"
                        >
                          ↩️ Return
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 font-medium"
                          title="Delete item"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

