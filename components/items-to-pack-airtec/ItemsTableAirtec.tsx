'use client'

import { useState } from 'react'
import { ItemToPackAirtec } from '@/types/database'
import { BcItemCode } from '@/lib/bc-mapping/client'
import LabelScanPhotosModal, { filterLabelPhotoUrls } from '@/components/common/LabelScanPhotosModal'

interface ItemsTableAirtecProps {
  items: ItemToPackAirtec[]
  selectedItems: Set<number>
  onSelectItem: (id: number, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  sortColumn: keyof ItemToPackAirtec | null
  sortDirection: 'asc' | 'desc'
  onSort: (column: keyof ItemToPackAirtec) => void
  onRefresh: () => void
  onDelete: (id: number) => void
  getUrgencyGroup?: (item: ItemToPackAirtec) => number
}

export default function ItemsTableAirtec({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  onRefresh,
  onDelete,
  getUrgencyGroup,
}: ItemsTableAirtecProps) {
  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id))
  const [photoModal, setPhotoModal] = useState<{ urls: string[]; title: string } | null>(null)

  return (
    <div id="airtec-print-area" className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="print-col-hide px-4 py-4 text-left">
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
                className="print-col-id px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('id')}
              >
                ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-desc px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('beschrijving')}
              >
                Description {sortColumn === 'beschrijving' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-item px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('item_number')}
              >
                Item Number {sortColumn === 'item_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-lot px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('lot_number')}
              >
                Lot Number {sortColumn === 'lot_number' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-date px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('datum_opgestuurd')}
              >
                Date Sent {sortColumn === 'datum_opgestuurd' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-box px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('kistnummer')}
              >
                Box Number {sortColumn === 'kistnummer' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-div px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('divisie')}
              >
                Division {sortColumn === 'divisie' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="print-col-qty px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('quantity')}
              >
                Qty {sortColumn === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="print-col-prio px-4 py-4 text-left text-sm font-medium text-gray-700">
                Priority
              </th>
              <th className="print-col-hide px-4 py-4 text-left text-sm font-medium text-gray-700">
                Label
              </th>
              <th className="print-col-hide px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
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
                const urgency = getUrgencyGroup ? getUrgencyGroup(item) : 2
                const rowClass = urgency === 0
                  ? 'bg-purple-100 border-l-4 border-l-purple-500'
                  : urgency === 1
                    ? 'bg-orange-100 border-l-4 border-l-orange-500'
                    : item.priority ? 'bg-yellow-50 priority-row' : ''
                const labelUrls = filterLabelPhotoUrls(item.label_scan_photo_urls)
                const rowClickable = labelUrls.length > 0
                return (
                <tr
                  key={item.id}
                  className={`${rowClass}${rowClickable ? ' cursor-pointer hover:brightness-[0.98]' : ''}`}
                  title={rowClickable ? 'Klik om labelfoto’s te bekijken' : undefined}
                  onClick={() => {
                    if (rowClickable) {
                      setPhotoModal({
                        urls: labelUrls,
                        title: `Labelfoto’s — regel ${item.id}${idPart(item)}`,
                      })
                    }
                  }}
                >
                  <td className="print-col-hide px-4 py-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => onSelectItem(item.id, e.target.checked)}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </td>
                  <td className="print-col-id px-4 py-4 text-sm text-gray-900">{item.id}</td>
                  <td className="print-col-desc px-4 py-4 text-sm text-gray-900">{item.beschrijving || '-'}</td>
                  <td className="print-col-item px-4 py-4 text-sm font-medium text-gray-900">
                    {item.item_number ? <BcItemCode value={item.item_number} /> : '-'}
                  </td>
                  <td className="print-col-lot px-4 py-4 text-sm text-gray-900">{item.lot_number || '-'}</td>
                  <td className="print-col-date px-4 py-4 text-sm text-gray-900">
                    {item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString() : '-'}
                  </td>
                  <td className="print-col-box px-4 py-4 text-sm text-gray-900">{item.kistnummer || '-'}</td>
                  <td className="print-col-div px-4 py-4 text-sm text-gray-900">{item.divisie || '-'}</td>
                  <td className="print-col-qty px-4 py-4 text-sm text-gray-900">{item.quantity}</td>
                  <td className="print-col-prio px-4 py-4">
                    {item.priority && (
                      <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-medium">
                        ⭐ Priority
                      </span>
                    )}
                  </td>
                  <td className="print-col-hide px-4 py-4 text-center text-sm text-gray-500">
                    {rowClickable ? (
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 text-sm"
                        aria-hidden
                      >
                        📷
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="print-col-hide px-4 py-4" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      <LabelScanPhotosModal
        open={photoModal != null}
        onClose={() => setPhotoModal(null)}
        urls={photoModal?.urls ?? []}
        title={photoModal?.title}
      />
    </div>
  )
}

function idPart(item: ItemToPackAirtec): string {
  const n = item.item_number ? String(item.item_number) : ''
  return n ? ` — ${n}` : ''
}

