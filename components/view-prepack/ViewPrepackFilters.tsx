'use client'

interface ViewPrepackFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCount: number
  totalAmount: number
  onConfirm: () => void
}

export default function ViewPrepackFilters({
  searchTerm,
  onSearchChange,
  selectedCount,
  totalAmount,
  onConfirm,
}: ViewPrepackFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by item number or pallet number..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-lg font-medium">
            Total Amount: <span className="font-bold text-blue-600">{totalAmount}</span>
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
            ✓ Confirm & Move to Items to Pack
          </button>
        </div>
      </div>
    </div>
  )
}

