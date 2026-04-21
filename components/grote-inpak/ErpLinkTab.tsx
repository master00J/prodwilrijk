'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, Upload, AlertCircle, Copy, RefreshCw } from 'lucide-react'
import { BcItemCode, useBcMapping } from '@/lib/bc-mapping/client'

interface ErpLinkEntry {
  id?: number
  kistnummer: string
  erp_code?: string | null
  productielocatie?: string | null
  description?: string | null
  stapel?: number | null
  created_at?: string
  updated_at?: string
}

export default function ErpLinkTab() {
  const { toNew: bcToNew } = useBcMapping()
  const [entries, setEntries] = useState<ErpLinkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [filterLocatie, setFilterLocatie] = useState<string>('')
  const [filterKisttype, setFilterKisttype] = useState<string>('')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [syncingKanban, setSyncingKanban] = useState(false)
  const [formData, setFormData] = useState<ErpLinkEntry>({
    kistnummer: '',
    erp_code: '',
    productielocatie: '',
    description: '',
    stapel: 1,
  })

  const loadEntries = useCallback(async (syncKanban = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/grote-inpak/erp-link${syncKanban ? '?sync_kanban=1' : ''}`)
      if (!response.ok) {
        throw new Error('Failed to load ERP LINK data')
      }
      const result = await response.json()
      setEntries(result.data || [])
      return result._synced_kanban
    } catch (err: any) {
      setError(err.message || 'Error loading ERP LINK data')
      console.error('Error loading ERP LINK:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSyncKanban = async () => {
    setSyncingKanban(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/grote-inpak/erp-link?sync_kanban=1')
      if (!res.ok) throw new Error('Sync mislukt')
      const result = await res.json()
      setEntries(result.data || [])
      setSuccess('Alle ERP LINK kisten zijn gesynchroniseerd naar Kanban Rekken. Stock/Excel zou nu correct moeten koppelen.')
    } catch (err: any) {
      setError(err.message || 'Sync mislukt')
    } finally {
      setSyncingKanban(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleEdit = (entry: ErpLinkEntry) => {
    setEditingId(entry.id || null)
    setFormData({
      kistnummer: entry.kistnummer || '',
      erp_code: entry.erp_code || '',
      productielocatie: entry.productielocatie || '',
      description: entry.description || '',
      stapel: entry.stapel || 1,
    })
    setIsAdding(false)
  }

  const handleAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({
      kistnummer: '',
      erp_code: '',
      productielocatie: '',
      description: '',
      stapel: 1,
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({
      kistnummer: '',
      erp_code: '',
      productielocatie: '',
      description: '',
      stapel: 1,
    })
  }

  const handleSave = async () => {
    setError(null)
    try {
      if (!formData.kistnummer.trim()) {
        setError('Kistnummer is verplicht')
        return
      }

      let response
      if (editingId) {
        response = await fetch('/api/grote-inpak/erp-link', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            ...formData,
          }),
        })
      } else {
        response = await fetch('/api/grote-inpak/erp-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save ERP LINK entry')
      }

      await loadEntries()
      handleCancel()
    } catch (err: any) {
      setError(err.message || 'Error saving ERP LINK entry')
      console.error('Error saving ERP LINK:', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) {
      return
    }

    setError(null)
    try {
      const response = await fetch(`/api/grote-inpak/erp-link?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete ERP LINK entry')
      }

      await loadEntries()
    } catch (err: any) {
      setError(err.message || 'Error deleting ERP LINK entry')
      console.error('Error deleting ERP LINK:', err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', 'erp')

      const response = await fetch('/api/grote-inpak/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload ERP LINK file')
      }

      const result = await response.json()
      const uploadedData = result.data || []

      if (!uploadedData || uploadedData.length === 0) {
        throw new Error('Geen data gevonden in het geüploade bestand')
      }

      let savedCount = 0
      let skippedCount = 0
      let errorCount = 0

      for (const item of uploadedData) {
        if (item.kistnummer) {
          try {
            const saveResponse = await fetch('/api/grote-inpak/erp-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kistnummer: item.kistnummer,
                erp_code: item.erp_code || null,
                productielocatie: item.productielocatie || null,
                description: item.description || null,
                stapel: item.stapel || 1,
              }),
            })

            if (saveResponse.ok) {
              savedCount++
            } else {
              const errorData = await saveResponse.json()
              if (errorData.error && errorData.error.includes('already exists')) {
                skippedCount++
              } else {
                errorCount++
                console.warn('Error saving entry:', errorData.error)
              }
            }
          } catch (err) {
            errorCount++
            console.warn('Error saving entry:', err)
          }
        }
      }

      await loadEntries()

      if (errorCount === 0) {
        setSuccess(
          `ERP LINK bestand succesvol geüpload! ${savedCount} items toegevoegd${skippedCount > 0 ? `, ${skippedCount} items overgeslagen (duplicaten)` : ''}.`
        )
      } else {
        setSuccess(
          `ERP LINK bestand geüpload: ${savedCount} items toegevoegd, ${skippedCount} overgeslagen, ${errorCount} fouten.`
        )
      }

      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Error uploading ERP LINK file')
      console.error('Error uploading ERP LINK:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const filteredEntries = entries.filter((entry) => {
    if (filterLocatie) {
      const loc = (entry.productielocatie || '').toLowerCase().trim()
      const want = filterLocatie.toLowerCase()
      if (want === 'genk' && !loc.includes('genk')) return false
      if (want === 'wilrijk' && !loc.includes('wilrijk')) return false
    }
    if (filterKisttype) {
      const kist = (entry.kistnummer || '').trim().toUpperCase()
      const first = kist.charAt(0)
      if (filterKisttype === 'C' && first !== 'C') return false
      if (filterKisttype === 'K' && first !== 'K' && first !== 'V') return false
    }
    return true
  })

  const columnLabels: Record<string, string> = {
    kistnummer: 'Kistnummer',
    erp_code: 'Oude BC Code',
    new_bc_code: 'Nieuwe BC Code',
    productielocatie: 'Productielocatie',
    description: 'Beschrijving',
    stapel: 'Stapel',
  }

  const copyColumn = async (field: 'kistnummer' | 'erp_code' | 'new_bc_code' | 'productielocatie' | 'description' | 'stapel') => {
    const values = filteredEntries.map((entry) => {
      if (field === 'stapel') return String(entry.stapel ?? 1)
      if (field === 'new_bc_code') {
        const raw = entry.erp_code ? String(entry.erp_code).trim() : ''
        return raw ? bcToNew(raw) : ''
      }
      const v = entry[field]
      return v != null && String(v).trim() !== '' ? String(v).trim() : ''
    })
    const text = values.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(`${columnLabels[field]} gekopieerd (${values.length} waarden)`)
      setTimeout(() => setCopyMessage(null), 2500)
    } catch {
      setCopyMessage('Kopiëren mislukt')
      setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Laden...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">ERP LINK Beheer</h2>
        <div className="flex gap-2">
          <label className={`flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploaden...' : 'Upload Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button
            onClick={handleSyncKanban}
            disabled={syncingKanban || entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            title="Zorgt dat alle kisten uit ERP LINK ook in Kanban Rekken staan (nodig voor stock/Excel koppeling)"
          >
            <RefreshCw className={`w-4 h-4 ${syncingKanban ? 'animate-spin' : ''}`} />
            {syncingKanban ? 'Syncen...' : 'Sync naar Kanban'}
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuw
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {copyMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800 text-sm">
          <Copy className="w-4 h-4 shrink-0" />
          <span>{copyMessage}</span>
        </div>
      )}

      {uploading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-800"></div>
          <span>ERP LINK bestand wordt geüpload en verwerkt...</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Locatie</label>
          <select
            value={filterLocatie}
            onChange={(e) => setFilterLocatie(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            <option value="Genk">Genk</option>
            <option value="Wilrijk">Wilrijk</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Kisttype</label>
          <select
            value={filterKisttype}
            onChange={(e) => setFilterKisttype(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            <option value="C">C-kisten</option>
            <option value="K">K-kisten</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {filteredEntries.length} van {entries.length} rijen
        </span>
      </div>

      {(isAdding || editingId !== null) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Bewerk ERP LINK Entry' : 'Nieuwe ERP LINK Entry'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kistnummer *
              </label>
              <input
                type="text"
                value={formData.kistnummer}
                onChange={(e) => setFormData({ ...formData, kistnummer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Bijv. K003, K107/K109"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ERP Code
              </label>
              <input
                type="text"
                value={formData.erp_code || ''}
                onChange={(e) => setFormData({ ...formData, erp_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Bijv. GP006311"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Productielocatie
              </label>
              <select
                value={formData.productielocatie || ''}
                onChange={(e) => setFormData({ ...formData, productielocatie: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecteer...</option>
                <option value="Wilrijk">Wilrijk</option>
                <option value="Genk">Genk</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschrijving
              </label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optionele beschrijving"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stapel
              </label>
              <input
                type="number"
                min={1}
                value={formData.stapel || 1}
                onChange={(e) => setFormData({ ...formData, stapel: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Save className="w-4 h-4" />
              Opslaan
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
              Annuleren
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('kistnummer')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Kistnummer <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('erp_code')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Oude BC Code <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('new_bc_code')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Nieuwe BC Code <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('productielocatie')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Productielocatie <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('description')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Beschrijving <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => copyColumn('stapel')}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:bg-blue-50 rounded px-1 -ml-1 transition-colors"
                    title="Klik om hele kolom te kopiëren"
                  >
                    Stapel <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.kistnummer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {entry.erp_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono font-medium">
                    {entry.erp_code ? <BcItemCode value={entry.erp_code} /> : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.productielocatie || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.stapel || 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id || 0)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
