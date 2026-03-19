'use client'

import { useState, useRef, useEffect } from 'react'

interface ActionsBarProps {
  selectedCount: number
  totalCount: number
  onMarkAsPacked: () => void
  onSetPriority: () => void
  onSetMeasurement: () => void
  onSetProblem: () => void
  onRemoveProblem: () => void
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
  onSetProblem,
  onRemoveProblem,
  onDeleteSelected,
  onShowScanner,
  onShowTimer,
  activeTimerCount = 0,
}: ActionsBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleAction = (action: () => void) => {
    action()
    setIsDropdownOpen(false)
  }

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
        {/* Actions Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={selectedCount === 0}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg flex items-center gap-2"
          >
            Actions
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && selectedCount > 0 && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
              <div className="py-2">
                <button
                  onClick={() => handleAction(onMarkAsPacked)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                >
                  <span className="text-green-500">✓</span>
                  Mark as Packed
                </button>
                <button
                  onClick={() => handleAction(onSetPriority)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                >
                  <span className="text-yellow-500">⭐</span>
                  Set Priority
                </button>
                <button
                  onClick={() => handleAction(onSetMeasurement)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                >
                  <span className="text-purple-500">📏</span>
                  Set Measurement
                </button>
                <div className="border-t my-1"></div>
                <button
                  onClick={() => handleAction(onSetProblem)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                >
                  <span className="text-red-500">⚠️</span>
                  Mark as Problem
                </button>
                <button
                  onClick={() => handleAction(onRemoveProblem)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                >
                  <span className="text-green-500">✓</span>
                  Remove Problem
                </button>
                <div className="border-t my-1"></div>
                <button
                  onClick={() => handleAction(onDeleteSelected)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors text-red-600 flex items-center gap-2"
                >
                  <span>🗑️</span>
                  Delete Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scanner Button */}
        <button
          onClick={onShowScanner}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
        >
          📷 Scanner
        </button>

        {/* Timer Button */}
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
      </div>
    </div>
  )
}
