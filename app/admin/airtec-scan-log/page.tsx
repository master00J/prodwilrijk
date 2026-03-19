'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, ScanLine, Filter } from 'lucide-react'

interface ScanLogEntry {
  id: number
  scanned_at: string
  lot_number: string | null
  scan_a_raw: string | null
  scan_b_raw: string | null
  result: 'match' | 'mismatch' | 'error'
  item_id: number | null
  error_message: string | null
}

interface Stats {
  last30days: { total: number; match: number; mismatch: number; error: number }
  today:      { total: number; match: number; mismatch: number; error: number }
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const RESULT_STYLE = {
  match:    { icon: <CheckCircle2 className="w-4 h-4" />, cls: 'text-green-700 bg-green-100',  label: 'Match'    },
  mismatch: { icon: <XCircle      className="w-4 h-4" />, cls: 'text-red-700   bg-red-100',    label: 'Mismatch' },
  error:    { icon: <AlertTriangle className="w-4 h-4"/>, cls: 'text-orange-700 bg-orange-100', label: 'Error'    },
}

function KpiCard({ value, label, sub, color }: { value: number | string; label: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AirtecScanLogPage() {
  const [data,    setData]    = useState<ScanLogEntry[]>([])
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'match' | 'mismatch' | 'error'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (filter !== 'all') params.set('result', filter)
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString())
      if (dateTo)   params.set('to',   new Date(dateTo + 'T23:59:59').toISOString())

      const res  = await fetch(`/api/airtec-scan-log?${params}`)
      const json = await res.json()
      setData(json.data  ?? [])
      setStats(json.stats ?? null)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const s30 = stats?.last30days
  const st  = stats?.today
  const matchPct = s30 && s30.total > 0
    ? Math.round(s30.match / s30.total * 100)
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-7 h-7 text-blue-600" />
            Scan controle log — Airtec
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Elke scan poging op de items-to-pack-airtec pagina wordt hier gelogd.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Vernieuwen
        </button>
      </div>

      {/* KPI kaarten */}
      {stats && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vandaag</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard value={st?.total    ?? 0} label="Scans vandaag"  color="text-gray-800" />
            <KpiCard value={st?.match    ?? 0} label="Match"          color="text-green-600" />
            <KpiCard value={st?.mismatch ?? 0} label="Mismatch"       color="text-red-600" />
            <KpiCard value={st?.error    ?? 0} label="Error"          color="text-orange-600" />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Laatste 30 dagen</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard value={s30?.total    ?? 0}                          label="Totaal scans"      color="text-gray-800" />
            <KpiCard value={s30?.match    ?? 0}                          label="Matches"           color="text-green-600" sub={matchPct != null ? `${matchPct}% slaagrate` : undefined} />
            <KpiCard value={s30?.mismatch ?? 0}                          label="Mismatches"        color="text-red-600" />
            <KpiCard value={s30?.error    ?? 0}                          label="Errors"            color="text-orange-600" />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <Filter className="w-4 h-4 text-gray-400 self-center" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Resultaat</label>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle resultaten</option>
            <option value="match">Match</option>
            <option value="mismatch">Mismatch</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Van</label>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tot</label>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(dateFrom || dateTo || filter !== 'all') && (
          <button
            onClick={() => { setFilter('all'); setDateFrom(''); setDateTo('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-1.5"
          >
            Wis filters
          </button>
        )}
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Geen scan logs gevonden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 text-sm text-gray-500">
            {data.length} rijen getoond (max 500)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tijdstip</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Resultaat</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Lotnummer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scan 1</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scan 2</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Item ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Opmerking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(row => {
                  const rs = RESULT_STYLE[row.result] ?? RESULT_STYLE.error
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                        {fmtTs(row.scanned_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${rs.cls}`}>
                          {rs.icon}
                          {rs.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-800">
                        {row.lot_number ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 max-w-[160px] truncate" title={row.scan_a_raw ?? ''}>
                        {row.scan_a_raw ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 max-w-[160px] truncate" title={row.scan_b_raw ?? ''}>
                        {row.scan_b_raw ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {row.item_id ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-orange-600 text-xs max-w-[200px] truncate" title={row.error_message ?? ''}>
                        {row.error_message ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
