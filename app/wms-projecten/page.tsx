'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { WmsProject } from '@/types/database'

export default function WmsProjectsPage() {
  const [projects, setProjects] = useState<WmsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

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

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

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
    </div>
  )
}
