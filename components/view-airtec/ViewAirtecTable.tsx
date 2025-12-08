'use client'

import { IncomingGoodAirtec } from '@/types/database'

interface ViewAirtecTableProps {
  items: IncomingGoodAirtec[]
  selectedItems: Set<number>
  onSelectItem: (id: number, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  sortColumn: keyof IncomingGoodAirtec | null
  sortDirection: 'asc' | 'desc'
  onSort: (column: keyof IncomingGoodAirtec) => void
  onDelete: (id: number) => void
  loading: boolean
}

export default function ViewAirtecTable({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  onDelete,
  loading,
}: ViewAirtecTableProps) {
  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id))

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
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
                onClick={() => onSort('beschrijving')}
              >
                Description {sortColumn === 'beschrijving' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('item_number')}
              >
                Item Number {sortColumn === 'item_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('lot_number')}
              >
                Lot Number {sortColumn === 'lot_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('datum_opgestuurd')}
              >
                Date Sent {sortColumn === 'datum_opgestuurd' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('kistnummer')}
              >
                Box Number {sortColumn === 'kistnummer' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('divisie')}
              >
                Division {sortColumn === 'divisie' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('quantity')}
              >
                Quantity {sortColumn === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
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
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => onSelectItem(item.id, e.target.checked)}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.id}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.beschrijving || '-'}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    {item.item_number || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.lot_number || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.kistnummer || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.divisie || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onDelete(item.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

