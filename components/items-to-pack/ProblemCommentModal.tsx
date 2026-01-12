'use client'

import { useState, useEffect } from 'react'
import { ItemToPack } from '@/types/database'

interface ProblemCommentModalProps {
  itemId: number
  item: ItemToPack | undefined
  onClose: () => void
  onSave: (comment: string) => Promise<void>
}

export default function ProblemCommentModal({
  itemId,
  item,
  onClose,
  onSave,
}: ProblemCommentModalProps) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item?.problem_comment) {
      setComment(item.problem_comment)
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(comment)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Problem Comment</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {item && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>ID:</strong> {item.id}</div>
                <div><strong>Item Number:</strong> {item.item_number}</div>
                <div><strong>Pallet Number:</strong> {item.po_number}</div>
                <div><strong>Amount:</strong> {item.amount}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-medium">
                Problem Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe the problem with this item..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={6}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium disabled:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : 'Save Comment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


