'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import ImageUploadModal from '@/components/items-to-pack/ImageUploadModal'
import type { WmsProject, WmsProjectLine, WmsPackage, WmsStorageLocation } from '@/types/database'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'received', label: 'Ontvangen' },
  { value: 'packing', label: 'Inpakken' },
  { value: 'packed', label: 'Ingepakt' },
  { value: 'shipped', label: 'Verzonden' },
]

export default function WmsProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params?.id)
  const [project, setProject] = useState<WmsProject | null>(null)
  const [lines, setLines] = useState<WmsProjectLine[]>([])
  const [projectImages, setProjectImages] = useState<string[]>([])
  const [packages, setPackages] = useState<WmsPackage[]>([])
  const [storageLocations, setStorageLocations] = useState<WmsStorageLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [imageTarget, setImageTarget] = useState<{ id: number; type: string } | null>(null)
  const [newPackageNo, setNewPackageNo] = useState('')
  const [creatingPackage, setCreatingPackage] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'storage'>('overview')
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationCapacity, setNewLocationCapacity] = useState('')
  const [newLocationNotes, setNewLocationNotes] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  const fetchProject = useCallback(async () => {
    if (!Number.isFinite(projectId)) return
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`/api/wms-projects/${projectId}`)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.details || errorBody?.error || 'Failed to fetch project')
      }
      const data = await response.json()
      setProject(data.project)
      setLines(data.lines || [])
      setProjectImages(data.projectImages || [])
      setPackages(data.packages || [])
    } catch (error) {
      console.error('Error fetching WMS project:', error)
      setLoadError(error instanceof Error ? error.message : 'Project ophalen mislukt')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchStorageLocations = useCallback(async () => {
    try {
      const response = await fetch('/api/wms-storage-locations')
      if (!response.ok) throw new Error('Failed to fetch locations')
      const data = await response.json()
      setStorageLocations(data.locations || [])
    } catch (error) {
      console.error('Error fetching storage locations:', error)
    }
  }, [])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  useEffect(() => {
    fetchStorageLocations()
  }, [fetchStorageLocations])

  const filteredLines = useMemo(() => {
    if (statusFilter === 'all') return lines
    return lines.filter((line) => line.status === statusFilter)
  }, [lines, statusFilter])

  const openCount = useMemo(() => lines.filter((line) => line.status !== 'packed' && line.status !== 'shipped').length, [lines])
  const packedCount = useMemo(() => lines.filter((line) => line.status === 'packed' || line.status === 'shipped').length, [lines])
  const totalStorageM2 = useMemo(
    () => lines.reduce((sum, line) => sum + (line.storage_m2 || 0), 0),
    [lines]
  )

  const storageUsageByLocation = useMemo(() => {
    const map = new Map<string, number>()
    lines.forEach((line) => {
      const location = (line.storage_location || '').trim()
      if (!location) return
      map.set(location, (map.get(location) || 0) + (line.storage_m2 || 0))
    })
    return map
  }, [lines])

  const linesByPackageId = useMemo(() => {
    const map = new Map<number, WmsProjectLine[]>()
    lines.forEach((line) => {
      if (!line.package_id) return
      if (!map.has(line.package_id)) {
        map.set(line.package_id, [])
      }
      map.get(line.package_id)!.push(line)
    })
    return map
  }, [lines])

  const updateLineStatus = async (lineId: number, status: string) => {
    try {
      const response = await fetch(`/api/wms-projects/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Status update failed')
      setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, status } : line)))
    } catch (error) {
      console.error('Error updating line status:', error)
      alert('Status bijwerken mislukt')
    }
  }

  const updateLineFields = async (lineId: number, fields: Partial<WmsProjectLine>) => {
    try {
      const response = await fetch(`/api/wms-projects/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!response.ok) throw new Error('Update failed')
      setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...fields } : line)))
    } catch (error) {
      console.error('Error updating line fields:', error)
      alert('Bijwerken mislukt')
    }
  }

  const calculateStorageM2 = (lengthValue?: number | null, widthValue?: number | null) => {
    if (!lengthValue || !widthValue) return null
    return (lengthValue / 1000) * (widthValue / 1000)
  }

  const getLengthMmValue = (line: WmsProjectLine) =>
    line.length_mm ?? (line.length_cm ? line.length_cm * 10 : null)
  const getWidthMmValue = (line: WmsProjectLine) =>
    line.width_mm ?? (line.width_cm ? line.width_cm * 10 : null)

  const updateDimensions = (line: WmsProjectLine, nextLength: number | null, nextWidth: number | null) => {
    updateLineFields(line.id, {
      length_mm: nextLength,
      width_mm: nextWidth,
      length_cm: null,
      width_cm: null,
    })
  }

  const confirmDimensions = (line: WmsProjectLine, confirmed: boolean) => {
    const length = getLengthMmValue(line)
    const width = getWidthMmValue(line)
    const m2 = confirmed ? calculateStorageM2(length ?? null, width ?? null) : line.storage_m2 ?? null
    updateLineFields(line.id, {
      dimensions_confirmed: confirmed,
      storage_m2: m2,
    })
  }

  const assignLineToPackage = async (lineId: number, packageId: number | null) => {
    try {
      const response = await fetch('/api/wms-packages/assign-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, packageId }),
      })
      if (!response.ok) throw new Error('Assign failed')
      setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, package_id: packageId } : line)))
    } catch (error) {
      console.error('Error assigning line:', error)
      alert('Toewijzen mislukt')
    }
  }

  const createPackage = async () => {
    const trimmed = newPackageNo.trim()
    if (!trimmed) {
      alert('Vul een pakketnummer in')
      return
    }
    setCreatingPackage(true)
    try {
      const response = await fetch('/api/wms-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          package_no: trimmed,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Pakket aanmaken mislukt')
      }
      setPackages((prev) => [...prev, data.package])
      setNewPackageNo('')
    } catch (error: any) {
      console.error('Error creating package:', error)
      alert(error.message || 'Pakket aanmaken mislukt')
    } finally {
      setCreatingPackage(false)
    }
  }

  const updatePackage = async (packageId: number, fields: Partial<WmsPackage>) => {
    try {
      const response = await fetch(`/api/wms-packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!response.ok) throw new Error('Update failed')
      setPackages((prev) =>
        prev.map((pkg) => (pkg.id === packageId ? { ...pkg, ...fields } : pkg))
      )
    } catch (error) {
      console.error('Error updating package:', error)
      alert('Pakket bijwerken mislukt')
    }
  }

  const markPackageShipped = async (packageId: number) => {
    const shippedAt = new Date().toISOString().slice(0, 10)
    try {
      const response = await fetch(`/api/wms-packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_shipped: true, shipped_at: shippedAt }),
      })
      if (!response.ok) throw new Error('Update failed')
      setPackages((prev) =>
        prev.map((pkg) => (pkg.id === packageId ? { ...pkg, load_out_at: shippedAt } : pkg))
      )
      setLines((prev) =>
        prev.map((line) =>
          line.package_id === packageId ? { ...line, shipped_at: shippedAt } : line
        )
      )
    } catch (error) {
      console.error('Error marking package shipped:', error)
      alert('Pakket verzenden mislukt')
    }
  }

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

  const handleImageUpload = (id: number, type: string) => {
    setImageTarget({ id, type })
  }

  const closeImageUpload = () => setImageTarget(null)

  if (loading) {
    return <div className="text-center py-10 text-gray-600">Laden...</div>
  }

  if (!project) {
    return <div className="text-center py-10 text-gray-600">Project niet gevonden.</div>
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Project {project.project_no}</h1>
          <p className="text-gray-600 mt-1">{project.machine_type || 'Onbekend type'}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">
            Open: <span className="font-semibold">{openCount}</span>
          </div>
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg">
            Ingepakt: <span className="font-semibold">{packedCount}</span>
          </div>
          <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg">
            Opslag m2: <span className="font-semibold">{totalStorageM2.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Overzicht
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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-3">Algemene info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium">Modality:</span> {project.modality || '-'}</div>
            <div><span className="font-medium">Locatie:</span> {project.production_location || '-'}</div>
            <div><span className="font-medium">VMI ref:</span> {project.vmi_ref_no || '-'}</div>
            <div><span className="font-medium">VMI medewerker:</span> {project.vmi_employee || '-'}</div>
            <div><span className="font-medium">Transport week:</span> {project.transport_week_contract || '-'}</div>
            <div><span className="font-medium">Packing company:</span> {project.packing_company || '-'}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-3">Opmetingen in productie</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium">Locatie:</span> {project.measuring_location || '-'}</div>
            <div><span className="font-medium">Datum:</span> {project.measuring_date_requested || '-'}</div>
            <div><span className="font-medium">Contact:</span> {project.measuring_contact_person || '-'}</div>
            <div><span className="font-medium">Team:</span> {project.measuring_team || '-'}</div>
            <div><span className="font-medium">Hal:</span> {project.measuring_hall || '-'}</div>
          </div>
        </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-semibold">Projectfoto&apos;s</h2>
          <button
            onClick={() => handleImageUpload(project.id, 'wms_project')}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            Foto&apos;s uploaden
          </button>
        </div>
        {projectImages.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen foto&apos;s toegevoegd.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {projectImages.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24">
                <Image
                  src={url}
                  alt={`Projectfoto ${idx + 1}`}
                  fill
                  className="object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => window.open(url, '_blank')}
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
          <h2 className="text-xl font-semibold">Verpakkingen</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={newPackageNo}
              onChange={(e) => setNewPackageNo(e.target.value)}
              placeholder="Pakketnummer"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={createPackage}
              disabled={creatingPackage}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:bg-gray-300"
            >
              {creatingPackage ? 'Bezig...' : 'Pakket aanmaken'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Datum ontvangen staat op artikelniveau.
        </p>

        {packages.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen verpakkingen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Pakket</th>
                  <th className="px-3 py-2 text-left">Uit laden</th>
                  <th className="px-3 py-2 text-left">Opslag m2</th>
                  <th className="px-3 py-2 text-left">Locatie</th>
                  <th className="px-3 py-2 text-left">Artikelen</th>
                  <th className="px-3 py-2 text-left">Foto&apos;s</th>
                  <th className="px-3 py-2 text-left">Verzonden</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{pkg.package_no}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={pkg.load_out_at || ''}
                        onChange={(e) => updatePackage(pkg.id, { load_out_at: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pkg.storage_m2 ?? ''}
                        onChange={(e) =>
                          updatePackage(pkg.id, {
                            storage_m2: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={pkg.storage_location || ''}
                        onChange={(e) => updatePackage(pkg.id, { storage_location: e.target.value })}
                        list="storage-locations-datalist"
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-600 mb-2">
                        {(linesByPackageId.get(pkg.id) || []).length} artikel(en)
                      </div>
                      {(linesByPackageId.get(pkg.id) || []).length > 0 && (
                        <div className="text-xs text-gray-700 mb-2 space-y-1">
                          {(linesByPackageId.get(pkg.id) || []).map((line) => (
                            <div key={line.id}>
                              {line.article_no || line.packing_no || '-'}
                              {line.description ? ` · ${line.description}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600">
                          Selecteer artikelen
                        </summary>
                        <div className="mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                          {lines.map((line) => {
                            const label = `${line.article_no || line.packing_no || '-'}${line.description ? ` · ${line.description}` : ''}`
                            const checked = line.package_id === pkg.id
                            return (
                              <label key={line.id} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    assignLineToPackage(line.id, e.target.checked ? pkg.id : null)
                                  }
                                />
                                <span>{label}</span>
                              </label>
                            )
                          })}
                          {lines.length === 0 && (
                            <p className="text-xs text-gray-500">Geen lijnen beschikbaar.</p>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleImageUpload(pkg.id, 'wms_package')}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          title="Upload foto"
                        >
                          📷
                        </button>
                        {pkg.images && pkg.images.length > 0 && (
                          <div className="flex gap-1">
                            {pkg.images.slice(0, 3).map((img, idx) => (
                              <div key={idx} className="relative w-10 h-10">
                                <Image
                                  src={img}
                                  alt={`Pakketfoto ${idx + 1}`}
                                  fill
                                  className="object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => window.open(img, '_blank')}
                                  unoptimized
                                />
                              </div>
                            ))}
                            {pkg.images.length > 3 && (
                              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs">
                                +{pkg.images.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => markPackageShipped(pkg.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Markeer verzonden
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Verpakkingslijnen</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">Alle</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full">
          <table className="w-full text-[11px] table-fixed">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left w-12">Type</th>
                <th className="px-2 py-1 text-left">Omschrijving</th>
                <th className="px-2 py-1 text-left w-16">Artikel</th>
                <th className="px-2 py-1 text-left w-10">Qty</th>
                <th className="px-2 py-1 text-left w-28">Ontvangen</th>
                <th className="px-2 py-1 text-left w-28">Verzonden</th>
                <th className="px-2 py-1 text-left w-32">Afmetingen</th>
                <th className="px-2 py-1 text-left w-20">Opslag m2</th>
                <th className="px-2 py-1 text-left w-24">Locatie</th>
                <th className="px-2 py-1 text-left w-12">Afm OK</th>
                <th className="px-2 py-1 text-left w-20">Pakket</th>
                <th className="px-2 py-1 text-left w-20">Status</th>
                <th className="px-2 py-1 text-left w-16">Foto&apos;s</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1">
                    {line.line_type === 'outer_packing' ? 'Outer' : 'Part'}
                  </td>
                  <td className="px-2 py-1 break-words">{line.description || '-'}</td>
                  <td className="px-2 py-1">{line.article_no || '-'}</td>
                  <td className="px-2 py-1">{line.qty ?? '-'}</td>
                  <td className="px-2 py-1">
                    <input
                      type="date"
                      value={line.received_at || ''}
                      onChange={(e) => updateLineFields(line.id, { received_at: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-28"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="date"
                      value={line.shipped_at || ''}
                      onChange={(e) => updateLineFields(line.id, { shipped_at: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-28"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="1"
                        value={getLengthMmValue(line) ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value)
                          updateDimensions(line, value, getWidthMmValue(line))
                        }}
                        placeholder="L (mm)"
                        className="px-2 py-1 border border-gray-300 rounded text-[11px] w-14"
                      />
                      <span className="text-xs">x</span>
                      <input
                        type="number"
                        step="1"
                        value={getWidthMmValue(line) ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value)
                          updateDimensions(line, getLengthMmValue(line), value)
                        }}
                        placeholder="B (mm)"
                        className="px-2 py-1 border border-gray-300 rounded text-[11px] w-14"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={line.storage_m2 ?? ''}
                      onChange={(e) =>
                        updateLineFields(line.id, {
                          storage_m2: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-20"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={line.storage_location || ''}
                      onChange={(e) => updateLineFields(line.id, { storage_location: e.target.value })}
                      list="storage-locations-datalist"
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-24"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={Boolean(line.dimensions_confirmed)}
                      onChange={(e) => confirmDimensions(line, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={line.package_id ?? ''}
                      onChange={(e) =>
                        assignLineToPackage(
                          line.id,
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-20"
                    >
                      <option value="">Geen</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.package_no}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={line.status}
                      onChange={(e) => updateLineStatus(line.id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-[11px] w-20"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleImageUpload(line.id, 'wms_project_line')}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        title="Upload foto"
                      >
                        📷
                      </button>
                      {line.images && line.images.length > 0 && (
                        <div className="flex gap-1">
                          {line.images.slice(0, 3).map((img, idx) => (
                            <div key={idx} className="relative w-10 h-10">
                              <Image
                                src={img}
                                alt={`Foto ${idx + 1}`}
                                fill
                                className="object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(img, '_blank')}
                                unoptimized
                              />
                            </div>
                          ))}
                          {line.images.length > 3 && (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs">
                              +{line.images.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLines.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                    Geen lijnen voor deze filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
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

            <p className="text-xs text-gray-500 mb-3">
              Gebruik is berekend op basis van de lijnen in dit project.
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
                      <th className="px-3 py-2 text-left">In gebruik (project)</th>
                      <th className="px-3 py-2 text-left">Vrij</th>
                      <th className="px-3 py-2 text-left">Actief</th>
                      <th className="px-3 py-2 text-left">Opmerking</th>
                      <th className="px-3 py-2 text-left">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageLocations.map((loc) => {
                      const used = storageUsageByLocation.get(loc.name) || 0
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

      {storageLocations.length > 0 && (
        <datalist id="storage-locations-datalist">
          {storageLocations.map((loc) => (
            <option key={loc.id} value={loc.name} />
          ))}
        </datalist>
      )}

      {imageTarget && (
        <ImageUploadModal
          itemId={imageTarget.id}
          itemType={imageTarget.type}
          onClose={closeImageUpload}
          onUploaded={() => {
            closeImageUpload()
            fetchProject()
          }}
        />
      )}
    </div>
  )
}
