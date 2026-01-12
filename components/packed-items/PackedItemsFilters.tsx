'use client'

interface PackedItemsFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  dateFrom: string
  dateTo: string
  onDateFilterChange: (from: string, to: string) => void
  showOverdue: boolean
  onOverdueToggle: () => void
}

export default function PackedItemsFilters({
  searchTerm,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFilterChange,
  showOverdue,
  onOverdueToggle,
}: PackedItemsFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by item number or pallet number..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <label className="font-medium">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFilterChange(e.target.value, dateTo)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 items-center">
          <label className="font-medium">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateFilterChange(dateFrom, e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => onDateFilterChange('', '')}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
          >
            Clear Dates
          </button>
        )}
        <button
          onClick={onOverdueToggle}
          className={`px-6 py-2 rounded-lg font-medium ${
            showOverdue
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          ⏰ Show Items &gt;7 Days
        </button>
      </div>
    </div>
  )
}




