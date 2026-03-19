'use client'

interface PackedItemsFiltersAirtecProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  dateFrom: string
  dateTo: string
  onDateFilterChange: (from: string, to: string) => void
  kistnummerFilter: string
  onKistnummerFilterChange: (value: string) => void
}

export default function PackedItemsFiltersAirtec({
  searchTerm,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFilterChange,
  kistnummerFilter,
  onKistnummerFilterChange,
}: PackedItemsFiltersAirtecProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by description, item number, lot number, box number, division..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFilterChange(e.target.value, dateTo)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateFilterChange(dateFrom, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Kistnummer Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Box Number</label>
          <input
            type="text"
            placeholder="Box Number (Kistnummer)"
            value={kistnummerFilter}
            onChange={(e) => onKistnummerFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={3}
          />
        </div>
      </div>
    </div>
  )
}

