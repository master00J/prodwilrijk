'use client'

interface ActionsBarProps {
  selectedCount: number
  totalCount: number
  onMarkAsPacked: () => void
  onSetPriority: () => void
  onSetMeasurement: () => void
  onDeleteSelected: () => void
  onShowScanner: () => void
  onShowTimer: () => void
  activeTimerCount?: number
}

export default function ActionsBar({
  selectedCount,
  totalCount,
  onMarkAsPacked,
  onSetPriority,
  onSetMeasurement,
  onDeleteSelected,
  onShowScanner,
  onShowTimer,
  activeTimerCount = 0,
}: ActionsBarProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="text-lg font-medium">
          Open Items: <span className="font-bold">{totalCount}</span>
        </div>
        {selectedCount > 0 && (
          <div className="text-lg text-blue-600 font-medium">
            Selected: {selectedCount}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onMarkAsPacked}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          ✓ Mark as Packed
        </button>
        <button
          onClick={onShowScanner}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
        >
          📷 Scanner
        </button>
        <button
          onClick={onShowTimer}
          className={`px-6 py-3 rounded-lg font-medium text-lg ${
            activeTimerCount > 0
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-500 hover:bg-gray-600 text-white'
          }`}
        >
          ⏱️ {activeTimerCount > 0 ? `Active Timers (${activeTimerCount})` : 'Start Timer'}
        </button>
        <button
          onClick={onSetPriority}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          ⭐ Set Priority
        </button>
        <button
          onClick={onSetMeasurement}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          📏 Set Measurement
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
  )
}

