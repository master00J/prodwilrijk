'use client'

interface ViewAirtecFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCount: number
  totalQuantity: number
  onConfirm: () => void
  onDeleteSelected: () => void
}

export default function ViewAirtecFilters({
  searchTerm,
  onSearchChange,
  selectedCount,
  totalQuantity,
  onConfirm,
  onDeleteSelected,
}: ViewAirtecFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by description, item number, lot number, box number, division..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-lg font-medium">
            Total Quantity: <span className="font-bold text-blue-600">{totalQuantity}</span>
          </div>
          {selectedCount > 0 && (
            <div className="text-lg font-medium text-green-600">
              Selected: {selectedCount}
            </div>
          )}
          <button
            onClick={onConfirm}
            disabled={selectedCount === 0}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
          >
            ✓ Confirm Items
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
          >
            🗑️ Delete Selected
          </button>
        </div>
      </div>
    </div>
  )
}

