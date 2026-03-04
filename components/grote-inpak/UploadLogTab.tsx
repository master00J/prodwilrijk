'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, History, FileUp } from 'lucide-react'

interface UploadLogEntry {
  id: string
  uploaded_at: string
  upload_type: 'pils' | 'forecast'
  source: string
  cnt_added: number
  cnt_removed: number
  total_records: number
  cnt_date_change: number | null
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface UploadLogTabProps {
  refreshTrigger?: number
}

export default function UploadLogTab({ refreshTrigger = 0 }: UploadLogTabProps) {
  const [data, setData] = useState<UploadLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pils' | 'forecast'>('all')

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

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  const filtered = data.filter((row) => {
    if (filter === 'all') return true
    return row.upload_type === filter
  })

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
            onChange={(e) => setFilter(e.target.value as 'all' | 'pils' | 'forecast')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Alle uploads</option>
            <option value="pils">Alleen PILS</option>
            <option value="forecast">Alleen Forecast</option>
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
        Overzicht van alle PILS- en forecast-uploads met het aantal bijgekomen en verwijderde cases.
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
                <th className="text-right px-4 py-3 font-medium">Bijgekomen</th>
                <th className="text-right px-4 py-3 font-medium">Verwijderd</th>
                <th className="text-right px-4 py-3 font-medium">Datum wijziging</th>
                <th className="text-right px-4 py-3 font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtTs(row.uploaded_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        row.upload_type === 'pils'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {row.upload_type === 'pils' ? 'PILS' : 'Forecast'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.source}>
                    {row.source}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.cnt_added > 0 ? (
                      <span className="text-green-700 font-medium">+{row.cnt_added}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.cnt_removed > 0 ? (
                      <span className="text-red-700 font-medium">−{row.cnt_removed}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.cnt_date_change != null && row.cnt_date_change > 0 ? (
                      <span className="text-amber-700 font-medium">{row.cnt_date_change}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{row.total_records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
