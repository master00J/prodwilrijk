'use client'

import { useState, useEffect } from 'react'
import { ItemToPack } from '@/types/database'

interface MeasurementModalProps {
  item: ItemToPack | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

interface MeasurementData {
  packaging_method: string
  dimensions: string
  net_weight: string
  special_instructions: string
}

export default function MeasurementModal({
  item,
  isOpen,
  onClose,
  onSave,
}: MeasurementModalProps) {
  const [formData, setFormData] = useState<MeasurementData>({
    packaging_method: '',
    dimensions: '',
    net_weight: '',
    special_instructions: '',
  })
  const [loading, setLoading] = useState(false)
  const [existingMeasurement, setExistingMeasurement] = useState<any>(null)

  // Fetch existing measurement when modal opens
  useEffect(() => {
    if (isOpen && item) {
      fetchMeasurement()
    } else {
      setFormData({
        packaging_method: '',
        dimensions: '',
        net_weight: '',
        special_instructions: '',
      })
      setExistingMeasurement(null)
    }
  }, [isOpen, item])

  const fetchMeasurement = async () => {
    if (!item) return

    try {
      const response = await fetch(`/api/measurements?item_id=${item.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.measurements && data.measurements.length > 0) {
          const measurement = data.measurements[0]
          setExistingMeasurement(measurement)
          setFormData({
            packaging_method: measurement.packaging_method || '',
            dimensions: measurement.dimensions || '',
            net_weight: measurement.net_weight ? measurement.net_weight.toString() : '',
            special_instructions: measurement.special_instructions || '',
          })
        }
      }
    } catch (error) {
      console.error('Error fetching measurement:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return

    setLoading(true)
    try {
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          packaging_method: formData.packaging_method.trim() || null,
          dimensions: formData.dimensions.trim() || null,
          net_weight: formData.net_weight.trim() || null,
          special_instructions: formData.special_instructions.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save measurement')
      }

      alert('Opmetingen succesvol opgeslagen!')
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving measurement:', error)
      alert('Fout bij opslaan: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Opmetingen invullen
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Item:</span> {item.item_number}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Pallet Number:</span> {item.po_number}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Aantal:</span> {item.amount}
          </p>
        </div>

        {existingMeasurement && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ Er zijn al opmetingen opgeslagen voor dit item. Je kunt ze hier aanpassen.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="packaging_method"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Verpakkingsmethode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="packaging_method"
              value={formData.packaging_method}
              onChange={(e) =>
                setFormData({ ...formData, packaging_method: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Bijv. Kartonnen doos, Houten kist, Pallet, etc."
              required
            />
          </div>

          <div>
            <label
              htmlFor="dimensions"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Afmetingen <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="dimensions"
              value={formData.dimensions}
              onChange={(e) =>
                setFormData({ ...formData, dimensions: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Bijv. 50x30x20 cm of LxBxH in cm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="net_weight"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Netto gewicht (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="net_weight"
              step="0.01"
              min="0"
              value={formData.net_weight}
              onChange={(e) =>
                setFormData({ ...formData, net_weight: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Bijv. 12.5"
              required
            />
          </div>

          <div>
            <label
              htmlFor="special_instructions"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Speciale instructies
            </label>
            <textarea
              id="special_instructions"
              value={formData.special_instructions}
              onChange={(e) =>
                setFormData({ ...formData, special_instructions: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Voeg hier eventuele speciale instructies toe voor het verpakken van dit item..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
