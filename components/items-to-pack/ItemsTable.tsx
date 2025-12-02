'use client'

import { ItemToPack } from '@/types/database'
import { useState } from 'react'

interface ItemsTableProps {
  items: ItemToPack[]
  selectedItems: Set<number>
  onSelectItem: (id: number, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  sortColumn: keyof ItemToPack | null
  sortDirection: 'asc' | 'desc'
  onSort: (column: keyof ItemToPack) => void
  onRefresh: () => void
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
                Image
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isPriority = item.priority
                const isMeasurement = item.measurement
                const rowClass = [
                  isPriority && 'bg-yellow-50',
                  isMeasurement && 'bg-blue-50',
                  isPriority && isMeasurement && 'bg-gradient-to-r from-yellow-50 to-blue-50',
                ]
                  .filter(Boolean)
                  .join(' ')

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
                      {item.image ? (
                        <img
                          src={item.image}
                          alt="Item"
                          className="w-12 h-12 object-cover rounded cursor-pointer hover:scale-150 transition-transform"
                          onClick={() => item.image && handleImageClick(item.id, item.image!)}
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No image</span>
                      )}
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

