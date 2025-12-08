'use client'

interface FiltersBarAirtecProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  priorityOnly: boolean
  onPriorityToggle: () => void
  kistnummerFilter: string
  onKistnummerFilterChange: (value: string) => void
}

export default function FiltersBarAirtec({
  searchTerm,
  onSearchChange,
  priorityOnly,
  onPriorityToggle,
  kistnummerFilter,
  onKistnummerFilterChange,
}: FiltersBarAirtecProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by description, item number, lot number, box number, division..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>

        {/* Kistnummer Filter */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Box Number (Kistnummer)"
            value={kistnummerFilter}
            onChange={(e) => onKistnummerFilterChange(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            maxLength={3}
          />
          {kistnummerFilter && (
            <button
              onClick={() => onKistnummerFilterChange('')}
              className="px-4 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 text-lg"
            >
              Clear
            </button>
          )}
        </div>

        {/* Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onPriorityToggle}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-lg ${
              priorityOnly
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            ⭐ Priority
          </button>
        </div>
      </div>
    </div>
  )
}

