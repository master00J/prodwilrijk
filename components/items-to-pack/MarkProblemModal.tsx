'use client'

import { useState } from 'react'
import { ItemToPack } from '@/types/database'

interface MarkProblemModalProps {
  items: ItemToPack[]
  onClose: () => void
  onConfirm: (comment: string) => Promise<void>
}

export default function MarkProblemModal({
  items,
  onClose,
  onConfirm,
}: MarkProblemModalProps) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm(comment)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Mark as Problem</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm text-red-800 mb-2">
              <strong>{items.length} item{items.length !== 1 ? 's' : ''} will be marked as problem:</strong>
            </div>
            <div className="space-y-1 text-sm">
              {items.slice(0, 5).map((item) => (
                <div key={item.id} className="text-gray-700">
                  • {item.item_number} (Pallet: {item.po_number})
                </div>
              ))}
              {items.length > 5 && (
                <div className="text-gray-500 italic">
                  ... and {items.length - 5} more item{items.length - 5 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-medium">
                Problem Comment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe the problem with these items..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={6}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                This comment will be added to all selected items.
              </p>
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
                disabled={loading || !comment.trim()}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Marking...' : 'Mark as Problem'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}



