'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ItemToPack } from '@/types/database'

interface ReturnItemModalProps {
  itemId: number
  item: ItemToPack | undefined
  onClose: () => void
  onConfirm: (reason: string, imageFiles: File[]) => void
}

export default function ReturnItemModal({
  itemId,
  item,
  onClose,
  onConfirm,
}: ReturnItemModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)

    // Create previews
    const newPreviews: string[] = []
    selectedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          newPreviews.push(event.target.result as string)
          if (newPreviews.length === selectedFiles.length) {
            setPreviews(newPreviews)
          }
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setFiles(newFiles)
    setPreviews(newPreviews)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      alert('Please provide a reason for returning this item')
      return
    }

    setLoading(true)
    try {
      await onConfirm(reason, files)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Return Item</h2>
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
                Reason for Return <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Damaged, Not needed, Wrong item..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={4}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">
                Upload Photos (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {previews.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative w-full h-24">
                      <Image
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        fill
                        className="object-cover rounded-lg"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                disabled={loading || !reason.trim()}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Returning...' : 'Return Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

