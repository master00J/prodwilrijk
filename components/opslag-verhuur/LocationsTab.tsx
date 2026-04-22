'use client'

import { Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StorageRentalLocation } from '@/types/database'
import ActionMenu from './ActionMenu'
import SlideOver from './SlideOver'

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
  /** Bezet m² + #actieve opslagen per locatie. */
  usagePerLocation: Map<number, { usedM2: number; activeCount: number }>
}

function occupancyColor(pct: number): { bar: string; text: string } {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700' }
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-700' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
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
  usagePerLocation,
}: Props) {
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(true)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return locations
      .filter((l) => (showInactive ? true : l.active !== false))
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .map((l) => {
        const usage = usagePerLocation.get(l.id) ?? { usedM2: 0, activeCount: 0 }
        const capacity = Number(l.capacity_m2 || 0)
        const pct = capacity > 0 ? (usage.usedM2 / capacity) * 100 : null
        return { ...l, _usage: usage, _capacity: capacity, _pct: pct }
      })
      .sort((a, b) => (b._pct ?? 0) - (a._pct ?? 0))
  }, [locations, search, showInactive, usagePerLocation])

  const openCreate = () => { resetLocationForm(); setDrawerOpen(true) }
  const openEdit = (l: StorageRentalLocation) => {
    setEditingLocation(l)
    setLocationName(l.name)
    setLocationCapacity(l.capacity_m2?.toString() || '')
    setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); resetLocationForm() }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleLocationSubmit(e)
    if (!locationNameError && !locationCapacityError) setDrawerOpen(false)
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Locaties</h2>
            <span className="text-xs text-gray-500">
              {locations.filter((l) => l.active !== false).length} actief · {locations.length} totaal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek locatie..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Zoek locatie"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  aria-label="Zoekterm wissen"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              Toon inactief
            </label>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nieuwe locatie
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Locatie</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Opslagen</th>
                <th className="px-4 py-2.5 text-left min-w-[220px]">Bezetting</th>
                <th className="px-4 py-2.5 w-10" aria-label="Acties"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-sm text-gray-500 text-center">
                    {locations.length === 0 ? 'Nog geen locaties.' : 'Geen resultaten.'}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const isActive = l.active !== false
                  const pct = l._pct
                  const colors = pct !== null ? occupancyColor(pct) : null
                  const barWidth = pct !== null ? Math.min(100, Math.max(0, pct)) : 0
                  return (
                    <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${isActive ? '' : 'bg-gray-50/60 text-gray-500'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isActive ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums font-medium text-gray-900">
                        {l._usage.activeCount}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {l._capacity <= 0 ? (
                          <span className="text-xs text-gray-400">Geen capaciteit ingesteld</span>
                        ) : (
                          <div className="min-w-[200px]">
                            <div className="flex items-center justify-between text-xs tabular-nums mb-1">
                              <span className={`font-semibold ${colors?.text}`}>
                                {pct!.toFixed(1)}%
                              </span>
                              <span className="text-gray-500">
                                <span className="text-gray-900 font-medium">{l._usage.usedM2.toFixed(0)}</span>
                                <span className="text-gray-400"> / {l._capacity.toFixed(0)} m²</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${colors!.bar} transition-all`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionMenu
                          ariaLabel="Acties voor locatie"
                          items={[
                            {
                              label: 'Bewerken',
                              icon: <Pencil className="w-4 h-4" />,
                              onClick: () => openEdit(l),
                            },
                            {
                              label: isActive ? 'Deactiveer' : 'Activeer',
                              icon: <Power className="w-4 h-4" />,
                              onClick: () => toggleLocationActive(l),
                            },
                            {
                              label: 'Verwijder',
                              icon: <Trash2 className="w-4 h-4" />,
                              danger: true,
                              divider: true,
                              onClick: () => handleDelete('location', l.id),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingLocation ? 'Locatie bewerken' : 'Nieuwe locatie'}
        subtitle={editingLocation ? `ID #${editingLocation.id}` : undefined}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeDrawer}
              className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuleer
            </button>
            <button
              type="button"
              form="location-form"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
              disabled={savingLocation}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {savingLocation && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {editingLocation ? 'Bijwerken' : 'Toevoegen'}
            </button>
          </>
        }
      >
        <form id="location-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Naam <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                locationNameError ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!locationNameError}
            />
            {locationNameError && (
              <p className="text-xs text-red-600 mt-1">{locationNameError}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Capaciteit (m²)
            </label>
            <input
              value={locationCapacity}
              onChange={(e) => setLocationCapacity(e.target.value)}
              placeholder="bv. 1200"
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                locationCapacityError ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!locationCapacityError}
            />
            {locationCapacityError && (
              <p className="text-xs text-red-600 mt-1">{locationCapacityError}</p>
            )}
          </div>
        </form>
      </SlideOver>
    </>
  )
}
