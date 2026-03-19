'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'

interface Measurement {
  id: number
  item_id: number
  packaging_method: string | null
  dimensions: string | null
  net_weight: number | null
  special_instructions: string | null
  processed?: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  items_to_pack: {
    id: number
    item_number: string
    po_number: string
    amount: number
  }
}

export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'open' | 'processed'>('open')

  const fetchMeasurements = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/measurements')
      if (!response.ok) throw new Error('Failed to fetch measurements')
      const data = await response.json()
      setMeasurements(data.measurements || [])
    } catch (error) {
      console.error('Error fetching measurements:', error)
      alert('Fout bij ophalen opmetingen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeasurements()
  }, [fetchMeasurements])

  const filteredMeasurements = measurements.filter((measurement) => {
    const matchesSearch =
      !searchTerm ||
      measurement.items_to_pack.item_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      measurement.items_to_pack.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (measurement.packaging_method &&
        measurement.packaging_method.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesDate =
      !filterDate ||
      new Date(measurement.created_at).toISOString().split('T')[0] === filterDate

    return matchesSearch && matchesDate
  })

  const openMeasurements = filteredMeasurements.filter((measurement) => !measurement.processed)
  const processedMeasurements = filteredMeasurements.filter((measurement) => measurement.processed)

  const handleProcessedToggle = async (measurementId: number, nextValue: boolean) => {
    setUpdatingIds((prev) => new Set(prev).add(measurementId))
    setMeasurements((prev) =>
      prev.map((measurement) =>
        measurement.id === measurementId ? { ...measurement, processed: nextValue } : measurement
      )
    )

    try {
      const response = await fetch('/api/measurements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: measurementId, processed: nextValue }),
      })

      if (!response.ok) throw new Error('Failed to update processed status')
    } catch (error) {
      console.error('Error updating processed status:', error)
      setMeasurements((prev) =>
        prev.map((measurement) =>
          measurement.id === measurementId ? { ...measurement, processed: !nextValue } : measurement
        )
      )
      alert('Fout bij opslaan van verwerkt-status')
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(measurementId)
        return next
      })
    }
  }

  const renderTable = (list: Measurement[]) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Itemnummer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Palletnummer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aantal
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Verpakkingsmethode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Afmetingen
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Netto Gewicht (kg)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Speciale Instructies
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ingevuld op
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Verwerkt
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {list.map((measurement) => (
              <tr key={measurement.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {measurement.items_to_pack.item_number}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {measurement.items_to_pack.po_number}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {measurement.items_to_pack.amount}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {measurement.packaging_method || <span className="text-gray-400">-</span>}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {measurement.dimensions || <span className="text-gray-400">-</span>}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {measurement.net_weight !== null ? (
                    <span className="font-medium">{measurement.net_weight.toFixed(2)} kg</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                  {measurement.special_instructions ? (
                    <div className="whitespace-pre-wrap break-words">{measurement.special_instructions}</div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(measurement.created_at).toLocaleString('nl-NL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(measurement.processed)}
                      disabled={updatingIds.has(measurement.id)}
                      onChange={(e) => handleProcessedToggle(measurement.id, e.target.checked)}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">
                      {measurement.processed ? 'Verwerkt' : 'Open'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Terug naar Admin
          </Link>
          <h1 className="text-3xl font-bold">Opmetingen Overzicht</h1>
          <p className="text-gray-600 mt-2">
            Overzicht van alle ingevulde opmetingen voor items die nog niet bekend waren in het systeem.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoeken
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op itemnummer, palletnummer of verpakkingsmethode..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter op datum
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Totaal: <span className="font-semibold">{filteredMeasurements.length}</span> opmetingen ·
            Open: <span className="font-semibold">{openMeasurements.length}</span> · Verwerkt:{' '}
            <span className="font-semibold">{processedMeasurements.length}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('open')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'open' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Open ({openMeasurements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('processed')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'processed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Verwerkt ({processedMeasurements.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Laden...</div>
          </div>
        ) : filteredMeasurements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">
              {searchTerm || filterDate
                ? 'Geen opmetingen gevonden met de geselecteerde filters.'
                : 'Nog geen opmetingen ingevuld.'}
            </p>
          </div>
        ) : activeTab === 'open' && openMeasurements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">Geen open opmetingen.</p>
          </div>
        ) : activeTab === 'processed' && processedMeasurements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">Geen verwerkte opmetingen.</p>
          </div>
        ) : (
          renderTable(activeTab === 'open' ? openMeasurements : processedMeasurements)
        )}
      </div>
    </AdminGuard>
  )
}
