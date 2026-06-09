'use client'

import { useState, useRef, useEffect } from 'react'
import { IncomingGoodAirtec } from '@/types/database'
import { isSpecialPackItemNumber } from '@/lib/airtec/special-pack-items'
import SpecialPackBadge from '@/components/airtec/SpecialPackBadge'

interface ViewAirtecTableProps {
  items: IncomingGoodAirtec[]
  selectedItems: Set<number>
  onSelectItem: (id: number, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  sortColumn: keyof IncomingGoodAirtec | null
  sortDirection: 'asc' | 'desc'
  onSort: (column: keyof IncomingGoodAirtec) => void
  onDelete: (id: number) => void
  onUpdate: (id: number, field: keyof IncomingGoodAirtec, value: any) => Promise<void>
  loading: boolean
}

type EditingCell = { id: number; field: keyof IncomingGoodAirtec } | null

const EDITABLE_FIELDS: (keyof IncomingGoodAirtec)[] = [
  'beschrijving', 'item_number', 'lot_number', 'datum_opgestuurd', 'kistnummer', 'divisie', 'quantity',
]

export default function ViewAirtecTable({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  onDelete,
  onUpdate,
  loading,
}: ViewAirtecTableProps) {
  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id))
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const startEdit = (item: IncomingGoodAirtec, field: keyof IncomingGoodAirtec) => {
    if (!EDITABLE_FIELDS.includes(field)) return
    const raw = item[field]
    let display = ''
    if (field === 'datum_opgestuurd' && raw) {
      display = String(raw).split('T')[0]
    } else if (raw !== null && raw !== undefined) {
      display = String(raw)
    }
    setEditingCell({ id: item.id, field })
    setEditValue(display)
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const commitEdit = async () => {
    if (!editingCell || saving) return
    setSaving(true)
    try {
      let parsed: any = editValue
      if (editingCell.field === 'quantity') parsed = Number(editValue) || 0
      if (editingCell.field === 'datum_opgestuurd') parsed = editValue || null
      await onUpdate(editingCell.id, editingCell.field, parsed)
    } finally {
      setSaving(false)
      setEditingCell(null)
      setEditValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  const renderCell = (item: IncomingGoodAirtec, field: keyof IncomingGoodAirtec, displayValue: string) => {
    const isEditing = editingCell?.id === item.id && editingCell?.field === field
    const isEditable = EDITABLE_FIELDS.includes(field)

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={field === 'quantity' ? 'number' : field === 'datum_opgestuurd' ? 'date' : 'text'}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[80px]"
        />
      )
    }

    return (
      <span
        onClick={() => isEditable && startEdit(item, field)}
        className={isEditable ? 'cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 group relative' : ''}
        title={isEditable ? 'Klik om te bewerken' : undefined}
      >
        {displayValue || <span className="text-gray-300">—</span>}
        {isEditable && (
          <span className="hidden group-hover:inline-block ml-1 text-blue-400 text-xs">✏️</span>
        )}
      </span>
    )
  }

  const SortHeader = ({ col, label }: { col: keyof IncomingGoodAirtec; label: string }) => (
    <th
      className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => onSort(col)}
    >
      {label} {sortColumn === col && (sortDirection === 'asc' ? '↑' : '↓')}
    </th>
  )

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
        💡 Klik op een celwaarde om die te bewerken. Bevestig met Enter, annuleer met Escape.
      </div>
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
              <SortHeader col="id" label="ID" />
              <SortHeader col="beschrijving" label="Beschrijving" />
              <SortHeader col="item_number" label="Item Number" />
              <SortHeader col="lot_number" label="Lot Number" />
              <SortHeader col="datum_opgestuurd" label="Date Sent" />
              <SortHeader col="kistnummer" label="Box Number" />
              <SortHeader col="divisie" label="Divisie" />
              <SortHeader col="quantity" label="Quantity" />
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Labelfoto&apos;s</th>
              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Acties</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  Geen items gevonden
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const specialPack = isSpecialPackItemNumber(item.item_number)
                return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${specialPack ? 'bg-teal-50 border-l-4 border-l-teal-500' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => onSelectItem(item.id, e.target.checked)}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(item, 'beschrijving', item.beschrijving || '')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex flex-col gap-1">
                      {renderCell(item, 'item_number', item.item_number || '')}
                      {specialPack && <SpecialPackBadge compact />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(item, 'lot_number', item.lot_number || '')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(
                      item,
                      'datum_opgestuurd',
                      item.datum_opgestuurd ? new Date(item.datum_opgestuurd).toLocaleDateString('nl-NL') : ''
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(item, 'kistnummer', item.kistnummer || '')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(item, 'divisie', item.divisie || '')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(item, 'quantity', String(item.quantity ?? ''))}
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    <LabelScanPhotoThumbs urls={item.label_scan_photo_urls} />
                  </td>
                  <td className="px-4 py-3">
                    <button
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
    </div>
  )
}

function LabelScanPhotoThumbs({ urls }: { urls?: string[] | null }) {
  const list = (urls || []).filter(Boolean)
  if (list.length === 0) {
    return <span className="text-gray-300">—</span>
  }
  const shown = list.slice(-5)
  const extra = list.length - shown.length
  return (
    <div className="flex flex-wrap gap-1 items-center max-w-[220px]">
      {shown.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open labelfoto"
          className="shrink-0 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-indigo-300"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-9 h-9 object-cover block" />
        </a>
      ))}
      {extra > 0 && (
        <span className="text-xs text-gray-500 whitespace-nowrap" title={`${list.length} foto’s in totaal`}>
          +{extra}
        </span>
      )}
    </div>
  )
}
