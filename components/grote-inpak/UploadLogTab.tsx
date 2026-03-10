'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, History, FileUp } from 'lucide-react'

interface UploadLogEntry {
  id: string
  uploaded_at: string
  upload_type: 'pils' | 'forecast' | 'packed'
  source: string
  cnt_added: number
  cnt_removed: number
  cnt_updated: number | null
  total_records: number
  cnt_date_change: number | null
  case_types_new: string[] | null
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pils:     { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'PILS'     },
  forecast: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Forecast' },
  packed:   { bg: 'bg-purple-100',  text: 'text-purple-800',  label: 'Packed'   },
}

interface UploadLogTabProps {
  refreshTrigger?: number
}

export default function UploadLogTab({ refreshTrigger = 0 }: UploadLogTabProps) {
  const [data, setData]     = useState<UploadLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pils' | 'forecast' | 'packed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/grote-inpak/upload-log')
      if (res.ok) {
        const result = await res.json()
        setData(result.data || [])
      }
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshTrigger])

  const filtered = data.filter(row => filter === 'all' || row.upload_type === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-7 h-7" />
          Upload historiek
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Alle uploads</option>
            <option value="pils">Alleen PILS</option>
            <option value="forecast">Alleen Forecast</option>
            <option value="packed">Alleen Packed</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-sm">
        Overzicht van alle uploads met het aantal bijgekomen, bijgewerkte en verwijderde records.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 rounded-lg border-2 border-dashed border-gray-200">
          <FileUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Geen uploads gevonden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Bestand(en)</th>
                <th className="text-right px-4 py-3 font-medium text-green-700">Bijgekomen</th>
                <th className="text-right px-4 py-3 font-medium text-blue-700">Bijgewerkt</th>
                <th className="text-right px-4 py-3 font-medium text-red-700">Verwijderd</th>
                <th className="text-right px-4 py-3 font-medium text-amber-700">Datum wijziging</th>
                <th className="text-right px-4 py-3 font-medium">Totaal</th>
                <th className="text-left px-4 py-3 font-medium">Nieuwe kisttypes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const style = TYPE_STYLE[row.upload_type] ?? TYPE_STYLE.pils
                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {fmtTs(row.uploaded_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600" title={row.source}>
                      {row.source}
                    </td>
                    {/* Bijgekomen */}
                    <td className="px-4 py-3 text-right">
                      {row.cnt_added > 0
                        ? <span className="text-green-700 font-medium">+{row.cnt_added}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    {/* Bijgewerkt (alleen packed) */}
                    <td className="px-4 py-3 text-right">
                      {row.cnt_updated != null && row.cnt_updated > 0
                        ? <span className="text-blue-700 font-medium">{row.cnt_updated}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Verwijderd */}
                    <td className="px-4 py-3 text-right">
                      {row.cnt_removed > 0
                        ? <span className="text-red-700 font-medium">−{row.cnt_removed}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    {/* Datum wijziging (alleen forecast) */}
                    <td className="px-4 py-3 text-right">
                      {row.cnt_date_change != null && row.cnt_date_change > 0
                        ? <span className="text-amber-700 font-medium">{row.cnt_date_change}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {row.total_records}
                    </td>
                    {/* Nieuwe kisttypes (alleen packed) */}
                    <td className="px-4 py-3">
                      {row.case_types_new && row.case_types_new.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.case_types_new.map(ct => (
                            <span key={ct} className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded font-mono">
                              {ct}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
