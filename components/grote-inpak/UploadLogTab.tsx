'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, History, FileUp, ChevronDown, ChevronUp } from 'lucide-react'

interface UploadLogEntry {
  id: string
  uploaded_at: string
  upload_type: 'pils' | 'forecast' | 'packed' | 'kist_mail'
  source: string
  cnt_added: number
  cnt_removed: number
  cnt_updated: number | null
  total_records: number
  cnt_date_change: number | null
  case_types_new: string[] | null
  labels_added: string[] | null
  labels_removed: string[] | null
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pils:      { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'PILS'      },
  forecast:  { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Forecast'  },
  packed:    { bg: 'bg-purple-100',  text: 'text-purple-800',  label: 'Packed'    },
  kist_mail: { bg: 'bg-amber-100',   text: 'text-amber-900',    label: 'Kist-mail' },
}

const PREVIEW = 10 // max labels direct zichtbaar

// ── Label-lijstje met uitklap ────────────────────────────────────────────────
function LabelList({ labels, color }: { labels: string[]; color: 'green' | 'red' | 'purple' }) {
  const [open, setOpen] = useState(false)
  if (!labels || labels.length === 0) return <span className="text-gray-300">—</span>

  const visible = open ? labels : labels.slice(0, PREVIEW)
  const rest    = labels.length - PREVIEW

  const cls = {
    green:  { chip: 'bg-green-100 text-green-800',   btn: 'text-green-600 hover:text-green-800' },
    red:    { chip: 'bg-red-100   text-red-800',     btn: 'text-red-600   hover:text-red-800'   },
    purple: { chip: 'bg-purple-100 text-purple-800', btn: 'text-purple-600 hover:text-purple-800' },
  }[color]

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {visible.map(l => (
          <span key={l} className={`text-xs px-1.5 py-0.5 rounded font-mono ${cls.chip}`}>{l}</span>
        ))}
      </div>
      {labels.length > PREVIEW && (
        <button
          onClick={() => setOpen(v => !v)}
          className={`text-xs flex items-center gap-0.5 ${cls.btn}`}
        >
          {open
            ? <><ChevronUp className="w-3 h-3" /> Inklappen</>
            : <><ChevronDown className="w-3 h-3" /> +{rest} meer tonen</>}
        </button>
      )}
    </div>
  )
}

// ── Uitklapbare detailrij ────────────────────────────────────────────────────
function DetailRow({ row }: { row: UploadLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasLabels = (row.labels_added?.length ?? 0) > 0 || (row.labels_removed?.length ?? 0) > 0
  const hasCaseTypes = (row.case_types_new?.length ?? 0) > 0

  const style = TYPE_STYLE[row.upload_type] ?? TYPE_STYLE.pils

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50/50 ${hasLabels || hasCaseTypes ? 'cursor-pointer' : ''}`}
        onClick={() => (hasLabels || hasCaseTypes) && setOpen(v => !v)}
      >
        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
          <div className="flex items-center gap-1.5">
            {(hasLabels || hasCaseTypes) && (
              open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                   : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            )}
            {fmtTs(row.uploaded_at)}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
          </span>
        </td>
        <td className="px-4 py-3 max-w-xs truncate text-gray-600 text-xs" title={row.source}>
          {row.source}
        </td>
        {/* Bijgekomen */}
        <td className="px-4 py-3 text-right">
          {row.cnt_added > 0
            ? <span className="text-green-700 font-medium">+{row.cnt_added}</span>
            : <span className="text-gray-300">0</span>}
        </td>
        {/* Bijgewerkt */}
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
        {/* Datum wijziging */}
        <td className="px-4 py-3 text-right">
          {row.cnt_date_change != null && row.cnt_date_change > 0
            ? <span className="text-amber-700 font-medium">{row.cnt_date_change}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-right font-medium text-gray-800">
          {row.total_records}
        </td>
      </tr>

      {/* Uitklapbare detailrij met exacte labels */}
      {open && (hasLabels || hasCaseTypes) && (
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

              {/* Bijgekomen labels */}
              {(row.labels_added?.length ?? 0) > 0 && (
                <div>
                  <p className={`text-xs font-semibold mb-2 flex items-center gap-1 ${
                    row.upload_type === 'kist_mail' ? 'text-amber-800' : 'text-green-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full inline-block ${
                      row.upload_type === 'kist_mail' ? 'bg-amber-500' : 'bg-green-500'
                    }`} />
                    {row.upload_type === 'kist_mail'
                      ? `Caselabels via mail (${row.labels_added!.length})`
                      : `Bijgekomen (${row.labels_added!.length})`}
                  </p>
                  <LabelList labels={row.labels_added!} color={row.upload_type === 'kist_mail' ? 'purple' : 'green'} />
                </div>
              )}

              {/* Afgegane labels */}
              {(row.labels_removed?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Afgegaan ({row.labels_removed!.length})
                  </p>
                  <LabelList labels={row.labels_removed!} color="red" />
                </div>
              )}

              {/* Nieuwe kisttypes (packed) */}
              {hasCaseTypes && (
                <div>
                  <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    Nieuwe kisttypes ({row.case_types_new!.length})
                  </p>
                  <LabelList labels={row.case_types_new!} color="purple" />
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
interface UploadLogTabProps {
  refreshTrigger?: number
}

export default function UploadLogTab({ refreshTrigger = 0 }: UploadLogTabProps) {
  const [data, setData]       = useState<UploadLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'pils' | 'forecast' | 'packed' | 'kist_mail'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/grote-inpak/upload-log')
      if (res.ok) setData((await res.json()).data || [])
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
            <option value="kist_mail">Alleen kist-mail</option>
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
        Klik op een rij met ▼ om details te zien. Kist-mail: één rij per kalenderdag (Brussel), kolom Totaal = aantal verwerkte mails.
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
                <th className="text-right px-4 py-3 font-medium text-red-700">Afgegaan</th>
                <th className="text-right px-4 py-3 font-medium text-amber-700">Datum wijz.</th>
                <th className="text-right px-4 py-3 font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <DetailRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
