'use client'

import { useEffect, useMemo, useState } from 'react'

type CompareResult = {
  summary: {
    bc_total: number
    tablet_total: number
    only_in_bc: number
    only_in_tablet: number
    matched_unique: number
  }
  session_id?: number | null
  only_in_bc: string[]
  only_in_tablet: string[]
}

type HistoryEntry = {
  ts?: string | null
  code: string
  location?: string | null
  note?: string | null
  session_id?: number | null
  employee_name?: string | null
  bc_employee_name?: string | null
}

export default function PrepackComparePage() {
  const [files, setFiles] = useState<File[]>([])
  const [bcNoCol, setBcNoCol] = useState('B')
  const [bcRegisteredCol, setBcRegisteredCol] = useState('S')
  const [cmpDay, setCmpDay] = useState('')
  const [persistSession, setPersistSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)

  const [histDay, setHistDay] = useState('')
  const [histLoc, setHistLoc] = useState('ALL')
  const [histSession, setHistSession] = useState('')
  const [histRows, setHistRows] = useState<HistoryEntry[]>([])
  const [histSummary, setHistSummary] = useState<string>('')
  const [histSessions, setHistSessions] = useState<Array<{ id: number; label?: string | null }>>([])
  const [diffs, setDiffs] = useState<{ only_in_bc: string[]; only_in_web: string[]; matches: string[] } | null>(null)

  const fileList = useMemo(() => files.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`), [files])

  const handleFiles = (list: FileList | File[]) => {
    const arr = Array.from(list)
    const valid = arr.filter((f) => /\.(xlsx|xls)$/i.test(f.name))
    setFiles(valid)
  }

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    setLoading(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('bc_files', f))
      fd.set('bcNoCol', bcNoCol)
      fd.set('bcRegisteredCol', bcRegisteredCol)
      if (cmpDay) {
        fd.set('from', cmpDay)
        fd.set('to', cmpDay)
      }
      if (persistSession) fd.set('persistSession', 'true')

      const resp = await fetch('/api/prepack/compare-bc', { method: 'POST', body: fd })
      const data = await resp.json()
      if (!resp.ok || !data?.success) {
        throw new Error(data.error || 'Vergelijken mislukt')
      }
      setCompareResult(data)
    } catch (error: any) {
      alert(error.message || 'Vergelijken mislukt')
    } finally {
      setLoading(false)
    }
  }

  const loadSessions = async (day: string) => {
    if (!day) {
      setHistSessions([])
      return
    }
    const resp = await fetch(`/api/prepack/sessions?day=${encodeURIComponent(day)}`)
    const data = await resp.json()
    if (resp.ok && data?.success) {
      setHistSessions(data.sessions || [])
    }
  }

  const loadHistory = async () => {
    const params = new URLSearchParams()
    if (histDay) params.set('day', histDay)
    if (histLoc && histLoc !== 'ALL') params.set('location', histLoc)
    if (histSession) params.set('session_id', histSession)

    const resp = await fetch(`/api/prepack/history?${params.toString()}`)
    const data = await resp.json()
    if (!resp.ok || !data?.success) {
      alert(data.error || 'Historiek ophalen mislukt')
      return
    }

    if (histDay) {
      setHistRows(data.entries || [])
      setHistSummary(`Totaal: ${data.summary.total} — Uniek: ${data.summary.unique}`)
      if (data.day_diffs) {
        setDiffs({
          only_in_bc: data.day_diffs.only_in_bc || [],
          only_in_web: data.day_diffs.only_in_web || [],
          matches: data.day_diffs.matches || [],
        })
      } else if (data.session) {
        setDiffs({
          only_in_bc: data.session.only_in_bc || [],
          only_in_web: data.session.only_in_web || [],
          matches: data.session.matches || [],
        })
      } else {
        setDiffs(null)
      }
    } else {
      setHistRows(data.days || [])
      setHistSummary('Laatste dagen')
      setDiffs(null)
    }
  }

  useEffect(() => {
    if (histDay) loadSessions(histDay)
  }, [histDay])

  const downloadDiffs = () => {
    if (!diffs) return
    const rows = [
      ['Side', 'PAC'],
      ...diffs.only_in_bc.map((v) => ['BC_ONLY', v]),
      ...diffs.only_in_web.map((v) => ['WEB_ONLY', v]),
      ...diffs.matches.map((v) => ['MATCH', v]),
    ]
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `prepack_diffs_${histDay || 'dag'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">Prepack vergelijking (BC vs Website)</h1>
        <p className="text-sm text-gray-600">
          Upload een Business Central export en vergelijk met de website-scans.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <form onSubmit={handleCompare} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BC Excel (.xlsx) — meerdere toegestaan</label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer"
              onClick={() => document.getElementById('bc_files')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
            >
              Sleep bestanden hierheen of klik om te kiezen
            </div>
            <input
              id="bc_files"
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {fileList.length > 0 && (
              <ul className="mt-2 text-sm text-gray-600">
                {fileList.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BC kolom No. (letter)</label>
            <input
              type="text"
              value={bcNoCol}
              onChange={(e) => setBcNoCol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">BC kolom Registered (letter)</label>
            <input
              type="text"
              value={bcRegisteredCol}
              onChange={(e) => setBcRegisteredCol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">Dag voor vergelijking</label>
            <input
              type="date"
              value={cmpDay}
              onChange={(e) => setCmpDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-600">
              <input type="checkbox" checked={persistSession} onChange={(e) => setPersistSession(e.target.checked)} />
              Sessie bewaren (met afwijkingen)
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {loading ? 'Bezig...' : 'Uploaden en vergelijken'}
            </button>
          </div>
        </form>
      </div>

      {compareResult && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Resultaat</h3>
          <div className="flex flex-wrap gap-2 mb-4 text-sm">
            <span className="px-3 py-1 rounded-full border">BC totaal: {compareResult.summary.bc_total}</span>
            <span className="px-3 py-1 rounded-full border">Website totaal: {compareResult.summary.tablet_total}</span>
            <span className="px-3 py-1 rounded-full border text-red-600">Alleen in BC: {compareResult.summary.only_in_bc}</span>
            <span className="px-3 py-1 rounded-full border text-amber-600">Alleen in Website: {compareResult.summary.only_in_tablet}</span>
            <span className="px-3 py-1 rounded-full border text-green-600">Match (uniek): {compareResult.summary.matched_unique}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Alleen in BC</h4>
              <div className="border rounded-lg p-2 max-h-60 overflow-auto">
                {compareResult.only_in_bc.map((v) => (
                  <div key={v} className="font-mono text-sm">{v}</div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Alleen in Website</h4>
              <div className="border rounded-lg p-2 max-h-60 overflow-auto">
                {compareResult.only_in_tablet.map((v) => (
                  <div key={v} className="font-mono text-sm">{v}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Historiek</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dag</label>
            <input
              type="date"
              value={histDay}
              onChange={(e) => {
                setHistDay(e.target.value)
                setHistSession('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sessie</label>
            <select
              value={histSession}
              onChange={(e) => setHistSession(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Alle sessies</option>
              {histSessions.map((s) => (
                <option key={s.id} value={s.id}>{`#${s.id}${s.label ? ' - ' + s.label : ''}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
            <select
              value={histLoc}
              onChange={(e) => setHistLoc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="ALL">Alle</option>
              <option value="3PL">3PL</option>
              <option value="Service center">Service center</option>
              <option value="Powertools">Powertools</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadHistory} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Ophalen
            </button>
          </div>
        </div>
        {histSummary && <div className="text-sm text-gray-600 mb-2">{histSummary}</div>}

        {diffs && (
          <div className="mb-4">
            <div className="flex gap-2">
              <button
                onClick={downloadDiffs}
                className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Download afwijkingen (CSV)
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div>
                <h4 className="font-semibold mb-1">Alleen in BC ({diffs.only_in_bc.length})</h4>
                <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                  {diffs.only_in_bc.map((v) => (
                    <div key={v} className="font-mono text-sm">{v}</div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Alleen in Website ({diffs.only_in_web.length})</h4>
                <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                  {diffs.only_in_web.map((v) => (
                    <div key={v} className="font-mono text-sm">{v}</div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Matches ({diffs.matches.length})</h4>
                <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                  {diffs.matches.map((v) => (
                    <div key={v} className="font-mono text-sm">{v}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tijd</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notitie</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sessie</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">BC</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Website</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {histRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Geen historiek gevonden
                  </td>
                </tr>
              ) : (
                histRows.map((row, idx) => (
                  <tr key={`${row.code}-${idx}`}>
                    <td className="px-4 py-2 text-sm">{row.ts || ''}</td>
                    <td className="px-4 py-2 text-sm font-mono">{row.code}</td>
                    <td className="px-4 py-2 text-sm">{row.location || ''}</td>
                    <td className="px-4 py-2 text-sm">{row.note || ''}</td>
                    <td className="px-4 py-2 text-sm">{row.session_id ? `#${row.session_id}` : ''}</td>
                    <td className="px-4 py-2 text-sm">{row.bc_employee_name || '-'}</td>
                    <td className="px-4 py-2 text-sm">{row.employee_name || '-'}</td>
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
