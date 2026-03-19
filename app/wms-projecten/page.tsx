'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { WmsProject, WmsStorageLocation } from '@/types/database'

export default function WmsProjectsPage() {
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeTab, setActiveTab] = useState<'projects' | 'storage'>('projects')
  const [storageLocations, setStorageLocations] = useState<WmsStorageLocation[]>([])
  const [usageByLocation, setUsageByLocation] = useState<Record<string, number>>({})
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationCapacity, setNewLocationCapacity] = useState('')
  const [newLocationNotes, setNewLocationNotes] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const response = await fetch(`/api/wms-projects?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchStorageLocations = useCallback(async () => {
    try {
      const response = await fetch('/api/wms-storage-locations')
      if (!response.ok) throw new Error('Failed to fetch locations')
      const data = await response.json()
      setStorageLocations(data.locations || [])
      setUsageByLocation(data.usageByLocation || {})
    } catch (error) {
      console.error('Error fetching storage locations:', error)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetchStorageLocations()
  }, [fetchStorageLocations])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const createStorageLocation = async () => {
    const name = newLocationName.trim()
    if (!name) {
      alert('Vul een locatienaam in')
      return
    }
    setCreatingLocation(true)
    try {
      const response = await fetch('/api/wms-storage-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          capacity_m2: newLocationCapacity === '' ? null : Number(newLocationCapacity),
          notes: newLocationNotes || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Locatie aanmaken mislukt')
      setStorageLocations((prev) => [...prev, data.location])
      setNewLocationName('')
      setNewLocationCapacity('')
      setNewLocationNotes('')
    } catch (error: any) {
      console.error('Error creating storage location:', error)
      alert(error.message || 'Locatie aanmaken mislukt')
    } finally {
      setCreatingLocation(false)
    }
  }

  const updateStorageLocation = async (locationId: number, fields: Partial<WmsStorageLocation>) => {
    try {
      const response = await fetch(`/api/wms-storage-locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!response.ok) throw new Error('Update failed')
      setStorageLocations((prev) =>
        prev.map((loc) => (loc.id === locationId ? { ...loc, ...fields } : loc))
      )
    } catch (error) {
      console.error('Error updating storage location:', error)
      alert('Locatie bijwerken mislukt')
    }
  }

  const deleteStorageLocation = async (locationId: number) => {
    if (!confirm('Locatie verwijderen?')) return
    try {
      const response = await fetch(`/api/wms-storage-locations/${locationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Delete failed')
      setStorageLocations((prev) => prev.filter((loc) => loc.id !== locationId))
    } catch (error) {
      console.error('Error deleting storage location:', error)
      alert('Locatie verwijderen mislukt')
    }
  }

  const totalCapacity = useMemo(
    () => storageLocations.reduce((sum, loc) => sum + (loc.capacity_m2 || 0), 0),
    [storageLocations]
  )
  const totalUsed = useMemo(
    () => Object.values(usageByLocation).reduce((sum, value) => sum + value, 0),
    [usageByLocation]
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">WMS Projecten</h1>
          <p className="text-gray-600 mt-1">Overzicht van inkomende projecten en verpakkingslijnen.</p>
        </div>
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Zoek op project, machine of ref..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'projects'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Projecten
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'storage'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Opslag
        </button>
      </div>

      {activeTab === 'projects' && (
        <>
          {loading ? (
            <div className="text-center text-gray-600">Laden...</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-gray-600">Geen projecten gevonden.</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-left">Machine</th>
                    <th className="px-4 py-3 text-left">Modality</th>
                    <th className="px-4 py-3 text-left">Locatie</th>
                    <th className="px-4 py-3 text-left">VMI Ref</th>
                    <th className="px-4 py-3 text-left">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{project.project_no}</td>
                      <td className="px-4 py-3">{project.machine_type || '-'}</td>
                      <td className="px-4 py-3">{project.modality || '-'}</td>
                      <td className="px-4 py-3">{project.production_location || '-'}</td>
                      <td className="px-4 py-3">{project.vmi_ref_no || '-'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/wms-projecten/${project.id}`}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          Bekijk
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Opslaglocaties beheren</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="Locatienaam"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={newLocationCapacity}
                onChange={(e) => setNewLocationCapacity(e.target.value)}
                placeholder="Capaciteit m2"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newLocationNotes}
                onChange={(e) => setNewLocationNotes(e.target.value)}
                placeholder="Opmerking"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={createStorageLocation}
                disabled={creatingLocation}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:bg-gray-300"
              >
                {creatingLocation ? 'Bezig...' : 'Locatie toevoegen'}
              </button>
            </div>

            <div className="flex flex-wrap gap-3 mb-4 text-sm">
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                Totale capaciteit: <span className="font-semibold">{totalCapacity.toFixed(2)}</span> m2
              </div>
              <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                In gebruik: <span className="font-semibold">{totalUsed.toFixed(2)}</span> m2
              </div>
              <div className="bg-purple-50 text-purple-700 px-3 py-2 rounded-lg">
                Vrij: <span className="font-semibold">{(totalCapacity - totalUsed).toFixed(2)}</span> m2
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Gebruik is berekend op basis van alle lijnen in alle projecten.
            </p>

            {storageLocations.length === 0 ? (
              <p className="text-sm text-gray-500">Nog geen opslaglocaties.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Locatie</th>
                      <th className="px-3 py-2 text-left">Capaciteit m2</th>
                      <th className="px-3 py-2 text-left">In gebruik</th>
                      <th className="px-3 py-2 text-left">Vrij</th>
                      <th className="px-3 py-2 text-left">Actief</th>
                      <th className="px-3 py-2 text-left">Opmerking</th>
                      <th className="px-3 py-2 text-left">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageLocations.map((loc) => {
                      const used = usageByLocation[loc.name] || 0
                      const capacity = loc.capacity_m2 ?? null
                      const free = capacity !== null ? capacity - used : null
                      return (
                        <tr key={loc.id} className="border-b">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={loc.name}
                              onChange={(e) => updateStorageLocation(loc.id, { name: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={loc.capacity_m2 ?? ''}
                              onChange={(e) =>
                                updateStorageLocation(loc.id, {
                                  capacity_m2: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
                            />
                          </td>
                          <td className="px-3 py-2">{used.toFixed(2)}</td>
                          <td className="px-3 py-2">{free !== null ? free.toFixed(2) : '-'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(loc.active)}
                              onChange={(e) => updateStorageLocation(loc.id, { active: e.target.checked })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={loc.notes || ''}
                              onChange={(e) => updateStorageLocation(loc.id, { notes: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => deleteStorageLocation(loc.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                            >
                              Verwijderen
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
