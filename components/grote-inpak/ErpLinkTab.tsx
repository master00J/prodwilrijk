'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, Upload, AlertCircle } from 'lucide-react'

interface ErpLinkEntry {
  id?: number
  kistnummer: string
  erp_code?: string | null
  productielocatie?: string | null
  description?: string | null
  created_at?: string
  updated_at?: string
}

export default function ErpLinkTab() {
  const [entries, setEntries] = useState<ErpLinkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<ErpLinkEntry>({
    kistnummer: '',
    erp_code: '',
    productielocatie: '',
    description: '',
  })

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/grote-inpak/erp-link')
      if (!response.ok) {
        throw new Error('Failed to load ERP LINK data')
      }
      const result = await response.json()
      setEntries(result.data || [])
    } catch (err: any) {
      setError(err.message || 'Error loading ERP LINK data')
      console.error('Error loading ERP LINK:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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
        // Update existing
        response = await fetch('/api/grote-inpak/erp-link', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            ...formData,
          }),
        })
      } else {
        // Create new
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

      // Save each entry to database
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
              }),
            })

            if (saveResponse.ok) {
              savedCount++
            } else {
              const errorData = await saveResponse.json()
              // Check if it's a duplicate error
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

      // Show success message with statistics
      if (errorCount === 0) {
        setSuccess(
          `ERP LINK bestand succesvol geüpload! ${savedCount} items toegevoegd${skippedCount > 0 ? `, ${skippedCount} items overgeslagen (duplicaten)` : ''}.`
        )
      } else {
        setSuccess(
          `ERP LINK bestand geüpload: ${savedCount} items toegevoegd, ${skippedCount} overgeslagen, ${errorCount} fouten.`
        )
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Error uploading ERP LINK file')
      console.error('Error uploading ERP LINK:', err)
    } finally {
      setUploading(false)
      // Reset file input
      e.target.value = ''
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
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuw Toevoegen
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

      {uploading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-800"></div>
          <span>ERP LINK bestand wordt geüpload en verwerkt...</span>
        </div>
      )}

      {/* Add/Edit Form */}
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kistnummer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ERP Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productielocatie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Beschrijving
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Geen ERP LINK entries gevonden. Voeg er een toe of upload een Excel bestand.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.kistnummer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.erp_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.productielocatie === 'Wilrijk'
                            ? 'bg-orange-100 text-orange-800'
                            : entry.productielocatie === 'Genk'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.productielocatie || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {entry.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Bewerken"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => entry.id && handleDelete(entry.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  )
}

