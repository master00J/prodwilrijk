'use client'

interface FiltersBarProps {
  searchValue: string
  onSearchValueChange: (value: string) => void
  dateFilter: string
  onDateFilterChange: (value: string) => void
  priorityOnly: boolean
  onPriorityToggle: () => void
  measurementOnly: boolean
  onMeasurementToggle: () => void
  problemOnly: boolean
  onProblemToggle: () => void
  onShowReport: () => void
}

export default function FiltersBar({
  searchValue,
  onSearchValueChange,
  dateFilter,
  onDateFilterChange,
  priorityOnly,
  onPriorityToggle,
  measurementOnly,
  onMeasurementToggle,
  problemOnly,
  onProblemToggle,
  onShowReport,
}: FiltersBarProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>

        {/* Date Filter */}
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
          {dateFilter && (
            <button
              onClick={() => onDateFilterChange('')}
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
          <button
            onClick={onMeasurementToggle}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-lg ${
              measurementOnly
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            📏 Measurements
          </button>
          <button
            onClick={onProblemToggle}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-lg ${
              problemOnly
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            ⚠️ Problems
          </button>
        </div>
      </div>

      {/* Daily Report Button */}
      <div className="flex justify-end">
        <button
          onClick={onShowReport}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-lg"
        >
          📊 Daily Report
        </button>
      </div>
    </div>
  )
}



