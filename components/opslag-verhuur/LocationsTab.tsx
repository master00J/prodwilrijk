'use client'

import type { StorageRentalLocation } from '@/types/database'

type Props = {
  locations: StorageRentalLocation[]
  editingLocation: StorageRentalLocation | null
  locationName: string
  locationCapacity: string
  setEditingLocation: (l: StorageRentalLocation | null) => void
  setLocationName: (s: string) => void
  setLocationCapacity: (s: string) => void
  resetLocationForm: () => void
  handleLocationSubmit: (e: React.FormEvent) => void
  savingLocation: boolean
  handleDelete: (type: 'location', id: number) => void
  toggleLocationActive: (location: StorageRentalLocation) => void
  locationNameError?: string
  locationCapacityError?: string
}

export default function LocationsTab({
  locations,
  editingLocation,
  locationName,
  locationCapacity,
  setEditingLocation,
  setLocationName,
  setLocationCapacity,
  resetLocationForm,
  handleLocationSubmit,
  savingLocation,
  handleDelete,
  toggleLocationActive,
  locationNameError,
  locationCapacityError,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Locaties</h2>
        <span className="text-xs text-gray-500">{locations.length} totaal</span>
      </div>
      <details className="mb-4">
        <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
          {editingLocation ? 'Locatie aanpassen' : 'Nieuwe locatie toevoegen'}
        </summary>
        <form onSubmit={handleLocationSubmit} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Naam</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                locationNameError ? 'border-red-500' : 'border-gray-300'
              }`}
              aria-invalid={!!locationNameError}
            />
            {locationNameError && (
              <p className="text-xs text-red-600 mt-1">{locationNameError}</p>
            )}
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Capaciteit (m²)</label>
            <input
              value={locationCapacity}
              onChange={(e) => setLocationCapacity(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                locationCapacityError ? 'border-red-500' : 'border-gray-300'
              }`}
              aria-invalid={!!locationCapacityError}
            />
            {locationCapacityError && (
              <p className="text-xs text-red-600 mt-1">{locationCapacityError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingLocation}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {savingLocation && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {editingLocation ? 'Bijwerken' : 'Toevoegen'}
          </button>
          {editingLocation && (
            <button
              type="button"
              onClick={resetLocationForm}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Annuleer
            </button>
          )}
        </form>
      </details>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Capaciteit</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {locations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-sm text-gray-500 text-center">
                  Geen locaties
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className={location.active === false ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 text-sm">{location.name}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {location.capacity_m2 ? Number(location.capacity_m2).toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {location.active !== false ? 'Actief' : 'Inactief'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocation(location)
                          setLocationName(location.name)
                          setLocationCapacity(location.capacity_m2?.toString() || '')
                        }}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                      >
                        Bewerken
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLocationActive(location)}
                        className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                      >
                        {location.active === false ? 'Activeer' : 'Deactiveer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete('location', location.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                      >
                        Verwijder
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
