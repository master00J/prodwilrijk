'use client'

import { ItemToPack } from '@/types/database'
import { useState, useRef, useEffect } from 'react'

interface BarcodeScannerProps {
  items: ItemToPack[]
  onClose: () => void
  onItemsScanned: (ids: number[]) => void
}

export default function BarcodeScanner({
  items,
  onClose,
  onItemsScanned,
}: BarcodeScannerProps) {
  const [scannedItems, setScannedItems] = useState<ItemToPack[]>([])
  const [scanInput, setScanInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = (code: string) => {
    const trimmedCode = code.trim()
    if (!trimmedCode) return

    // Find item by item_number, po_number, or id
    const foundItem = items.find(
      item =>
        item.item_number?.toString() === trimmedCode ||
        item.po_number?.toString() === trimmedCode ||
        item.id.toString() === trimmedCode
    )

    if (!foundItem) {
      setError(`No matching item found for "${trimmedCode}"`)
      setTimeout(() => setError(null), 3000)
      return
    }

    // Check if already scanned
    if (scannedItems.some(item => item.id === foundItem.id)) {
      setError(`Item ${foundItem.item_number} already scanned`)
      setTimeout(() => setError(null), 3000)
      return
    }

    // Add to scanned items
    setScannedItems([...scannedItems, foundItem])
    setScanInput('')
    setError(null)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanInput(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(scanInput)
    }
  }

  const removeScannedItem = (id: number) => {
    setScannedItems(scannedItems.filter(item => item.id !== id))
  }

  const handleConfirm = () => {
    if (scannedItems.length === 0) {
      setError('No items scanned')
      return
    }
    onItemsScanned(scannedItems.map(item => item.id))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Barcode Scanner</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Scan or type item number"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
              <button
                onClick={() => handleScan(scanInput)}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
              >
                Add
              </button>
            </div>
            {error && (
              <div className="mt-2 text-red-500 text-sm">{error}</div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Scanned Items</h3>
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                {scannedItems.length}
              </span>
            </div>
            {scannedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No items scanned yet
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{item.item_number}</div>
                      <div className="text-sm text-gray-600">
                        Pallet: {item.po_number} | Amount: {item.amount}
                      </div>
                    </div>
                    <button
                      onClick={() => removeScannedItem(item.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium text-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={scannedItems.length === 0}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
            >
              Confirm ({scannedItems.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



