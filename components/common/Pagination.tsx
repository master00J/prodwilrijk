'use client'

import { useMemo } from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const paginationButtons = useMemo(() => {
    const buttons = []
    const maxButtons = 7
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
    let endPage = Math.min(totalPages, startPage + maxButtons - 1)

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1)
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key="first"
          onClick={() => onPageChange(1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          «
        </button>
      )
    }

    if (currentPage > 1) {
      buttons.push(
        <button
          key="prev"
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          ‹
        </button>
      )
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`px-4 py-2 border rounded-lg ${
            i === currentPage
              ? 'bg-blue-500 text-white border-blue-500'
              : 'border-gray-300 hover:bg-gray-100'
          }`}
        >
          {i}
        </button>
      )
    }

    if (currentPage < totalPages) {
      buttons.push(
        <button
          key="next"
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          ›
        </button>
      )
    }

    if (endPage < totalPages) {
      buttons.push(
        <button
          key="last"
          onClick={() => onPageChange(totalPages)}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          »
        </button>
      )
    }

    return buttons
  }, [currentPage, totalPages, onPageChange])

  if (totalPages <= 1) return null

  return (
    <div className="p-4 border-t flex justify-center items-center gap-2 flex-wrap">
      {paginationButtons}
    </div>
  )
}

