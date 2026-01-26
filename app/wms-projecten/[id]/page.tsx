'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import ImageUploadModal from '@/components/items-to-pack/ImageUploadModal'
import type { WmsProject, WmsProjectLine, WmsPackage } from '@/types/database'

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
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [imageTarget, setImageTarget] = useState<{ id: number; type: string } | null>(null)
  const [newPackageNo, setNewPackageNo] = useState('')
  const [creatingPackage, setCreatingPackage] = useState(false)

  const fetchProject = useCallback(async () => {
    if (!Number.isFinite(projectId)) return
    setLoading(true)
    try {
      const response = await fetch(`/api/wms-projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      setProject(data.project)
      setLines(data.lines || [])
      setProjectImages(data.projectImages || [])
      setPackages(data.packages || [])
    } catch (error) {
      console.error('Error fetching WMS project:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
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

        {packages.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen verpakkingen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Pakket</th>
                  <th className="px-3 py-2 text-left">Datum ontvangen</th>
                  <th className="px-3 py-2 text-left">In laden</th>
                  <th className="px-3 py-2 text-left">Uit laden</th>
                  <th className="px-3 py-2 text-left">Opslag m2</th>
                  <th className="px-3 py-2 text-left">Locatie</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{pkg.package_no}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={pkg.received_at || ''}
                        onChange={(e) => updatePackage(pkg.id, { received_at: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={pkg.load_in_at || ''}
                        onChange={(e) => updatePackage(pkg.id, { load_in_at: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
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
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Omschrijving</th>
                <th className="px-3 py-2 text-left">Artikel</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Afmetingen</th>
                <th className="px-3 py-2 text-left">Opslag m2</th>
                <th className="px-3 py-2 text-left">Locatie</th>
                <th className="px-3 py-2 text-left">Afm OK</th>
                <th className="px-3 py-2 text-left">Pakket</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Foto&apos;s</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {line.line_type === 'outer_packing' ? 'Outer' : 'Part'}
                  </td>
                  <td className="px-3 py-2">{line.description || '-'}</td>
                  <td className="px-3 py-2">{line.article_no || '-'}</td>
                  <td className="px-3 py-2">{line.qty ?? '-'}</td>
                  <td className="px-3 py-2">
                    {line.length_cm || line.length_mm ? (
                      <span>
                        {line.length_cm ?? line.length_mm} x {line.width_cm ?? line.width_mm} x {line.height_cm ?? line.height_mm}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.storage_m2 ?? ''}
                      onChange={(e) =>
                        updateLineFields(line.id, {
                          storage_m2: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={line.storage_location || ''}
                      onChange={(e) => updateLineFields(line.id, { storage_location: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(line.dimensions_confirmed)}
                      onChange={(e) => updateLineFields(line.id, { dimensions_confirmed: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={line.package_id ?? ''}
                      onChange={(e) =>
                        assignLineToPackage(
                          line.id,
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Geen</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.package_no}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={line.status}
                      onChange={(e) => updateLineStatus(line.id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
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
                  <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                    Geen lijnen voor deze filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
