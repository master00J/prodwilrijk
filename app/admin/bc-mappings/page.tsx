'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import * as XLSX from 'xlsx'

interface Mapping {
  old_code: string
  new_code: string
  description: string | null
  updated_at?: string | null
}

export default function BcMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bc-mappings?limit=10000')
      if (!res.ok) throw new Error(`Laden mislukt (${res.status})`)
      const data = (await res.json()) as { mappings: Mapping[] }
      setMappings(data.mappings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mappings
    return mappings.filter(
      (m) =>
        m.old_code.toLowerCase().includes(q) ||
        m.new_code.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
    )
  }, [mappings, search])

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (!file) return
      setError(null)
      setSuccess(null)
      setUploading(true)
      setUploadProgress('Excel lezen…')

      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        if (!ws) throw new Error('Eerste tabblad niet gevonden in Excel')
        // array van arrays, zonder header-interpretatie
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
        if (rows.length < 2) throw new Error('Excel lijkt leeg')

        // Header zoeken: eerste rij waar de eerste twee cellen niet-leeg zijn.
        // Vanaf de volgende rij: A = old, B = new, C = description.
        let startIdx = 0
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const [a, b] = [rows[i]?.[0], rows[i]?.[1]]
          if (typeof a === 'string' && typeof b === 'string') {
            const la = a.toLowerCase()
            const lb = b.toLowerCase()
            // heuristiek: headers bevatten "bc" / "foresco" / "code" / "old" / "new"
            if (/bc|foresco|code|old|new|oud|nieuw/.test(la) || /bc|foresco|code|old|new|oud|nieuw/.test(lb)) {
              startIdx = i + 1
              break
            }
          }
        }

        const payload: Array<{ old_code: string; new_code: string; description: string | null }> = []
        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i]
          if (!row) continue
          const oldCode = row[0] != null ? String(row[0]).trim() : ''
          const newCode = row[1] != null ? String(row[1]).trim() : ''
          const desc = row[2] != null ? String(row[2]).trim() : ''
          if (!oldCode || !newCode) continue
          payload.push({
            old_code: oldCode,
            new_code: newCode,
            description: desc || null,
          })
        }
        if (payload.length === 0) {
          throw new Error('Geen geldige rijen gevonden (verwacht kolom A=oud, B=nieuw, C=beschrijving)')
        }

        // In chunks uploaden zodat we niet 1 kolossale request doen.
        const chunkSize = 1000
        let totalSaved = 0
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize)
          setUploadProgress(`Uploaden ${i + chunk.length} / ${payload.length}…`)
          const res = await fetch('/api/admin/bc-mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mappings: chunk,
              replace: i === 0, // alleen de eerste chunk wist de tabel
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || `Upload mislukt (${res.status})`)
          }
          const data = (await res.json()) as { count?: number }
          totalSaved += Number(data.count || chunk.length)
        }

        setSuccess(`${totalSaved} mappings succesvol geïmporteerd.`)
        await fetchMappings()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload mislukt')
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [fetchMappings]
  )

  const handleClearAll = useCallback(async () => {
    if (!window.confirm('ALLE mappings verwijderen? Dit kan niet ongedaan gemaakt worden.')) return
    try {
      const res = await fetch('/api/admin/bc-mappings?all=true', { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      setMappings([])
      setSuccess('Alle mappings verwijderd.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }, [])

  const handleDeleteOne = useCallback(async (old_code: string) => {
    if (!window.confirm(`Mapping voor "${old_code}" verwijderen?`)) return
    try {
      const res = await fetch(
        `/api/admin/bc-mappings?old_code=${encodeURIComponent(old_code)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Verwijderen mislukt')
      setMappings((prev) => prev.filter((m) => m.old_code !== old_code))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }, [])

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BC artikelnummer mapping</h1>
            <p className="text-sm text-gray-600 mt-1">
              Vertaaltabel tussen oude en nieuwe Business Central artikelnummers. Bij elke weergave
              in de app wordt een oud nummer on-the-fly omgezet naar het nieuwe; het oude blijft als
              tooltip zichtbaar.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? uploadProgress || 'Bezig…' : '📥 Excel importeren (vervangt alles)'}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={uploading || mappings.length === 0}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50"
            >
              🗑️ Alles leegmaken
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-600 underline">
              sluit
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex items-center justify-between">
            <span>✓ {success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-600 underline">
              sluit
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="text-sm text-gray-600">
              <strong>{mappings.length.toLocaleString('nl-BE')}</strong> mappings geladen
              {search && (
                <span className="ml-2 text-gray-500">
                  · {filtered.length} match{filtered.length === 1 ? '' : 'en'}
                </span>
              )}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op oud nummer, nieuw nummer of omschrijving…"
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Laden…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {mappings.length === 0
                ? 'Nog geen mappings — importeer een Excel om te beginnen.'
                : 'Geen resultaten voor deze zoekopdracht.'}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Oud nummer</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Nieuw nummer</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Omschrijving</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.slice(0, 1000).map((m) => (
                    <tr key={m.old_code} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{m.old_code}</td>
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-indigo-700">
                        {m.new_code}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-[520px]">
                        {m.description || ''}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleDeleteOne(m.old_code)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          verwijder
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length > 1000 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-xs text-center text-gray-500">
                        … {filtered.length - 1000} extra rijen verborgen — gebruik de zoekbalk om te
                        filteren.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
