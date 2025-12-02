'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface ImageUploadModalProps {
  itemId: number
  itemType: string
  onClose: () => void
  onUploaded: () => void
}

export default function ImageUploadModal({
  itemId,
  itemType,
  onClose,
  onUploaded,
}: ImageUploadModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
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

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select at least one image')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('images', file)
      })
      formData.append('itemId', itemId.toString())
      formData.append('itemType', itemType)

      const response = await fetch('/api/items-to-pack/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload images')
      }

      alert('Images uploaded successfully!')
      onUploaded()
    } catch (error: any) {
      console.error('Error uploading images:', error)
      alert(error.message || 'Failed to upload images')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Upload Images</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">Select Images</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              You can select multiple images at once
            </p>
          </div>

          {previews.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Selected Images ({previews.length}):</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative w-full h-32">
                    <Image
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      fill
                      className="object-cover rounded-lg"
                      unoptimized
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium disabled:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {uploading ? 'Uploading...' : `Upload ${files.length} Image(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

