'use client'

interface FiltersBarAirtecProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  priorityOnly: boolean
  onPriorityToggle: () => void
}

export default function FiltersBarAirtec({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  priorityOnly,
  onPriorityToggle,
}: FiltersBarAirtecProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Zoek op beschrijving, item number, lot number, divisie..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSearchSubmit()
                }
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            <button
              onClick={onSearchSubmit}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
            >
              Zoek
            </button>
          </div>
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

