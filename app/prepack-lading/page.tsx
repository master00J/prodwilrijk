'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Trash2, Copy, Undo2 } from 'lucide-react'

type Entry = {
  id: string
  ts: string
  code: string
  location: string
  note: string
}

const STORAGE_KEY = 'prepack_lading_entries_v1'
const SETTINGS_KEY = 'prepack_lading_settings_v1'

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const formatTimestamp = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const sanitizeCode = (value: string) => value.replace(/[\r\n\t]/g, '').trim()

export default function PrepackLadingPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [barcode, setBarcode] = useState('')
  const [location, setLocation] = useState('3PL')
  const [note, setNote] = useState('')
  const [beepEnabled, setBeepEnabled] = useState(true)
  const [focusEnabled, setFocusEnabled] = useState(true)
  const [timestampEnabled, setTimestampEnabled] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setEntries(JSON.parse(raw))
    } catch {}
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY)
      if (rawSettings) {
        const s = JSON.parse(rawSettings)
        if (typeof s.beep === 'boolean') setBeepEnabled(s.beep)
        if (typeof s.focus === 'boolean') setFocusEnabled(s.focus)
        if (typeof s.ts === 'boolean') setTimestampEnabled(s.ts)
        if (typeof s.loc === 'string') setLocation(s.loc)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {}
  }, [entries])

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ beep: beepEnabled, focus: focusEnabled, ts: timestampEnabled, loc: location })
      )
    } catch {}
  }, [beepEnabled, focusEnabled, timestampEnabled, location])

  useEffect(() => {
    if (focusEnabled) {
      inputRef.current?.focus()
    }
  }, [focusEnabled])

  const totalCount = entries.length
  const uniqueCount = useMemo(() => new Set(entries.map((e) => e.code)).size, [entries])

  const playBeep = () => {
    if (!beepEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
      osc.start()
      setTimeout(() => {
        osc.stop()
        ctx.close()
      }, 150)
    } catch {}
  }

  const addEntry = async () => {
    const code = sanitizeCode(barcode)
    if (!code) return
    const ts = timestampEnabled ? formatTimestamp(new Date()) : ''
    const entry: Entry = {
      id: createId(),
      ts,
      code,
      location,
      note: note.trim(),
    }
    setEntries((prev) => [entry, ...prev])
    setBarcode('')
    playBeep()
    if (focusEnabled) inputRef.current?.focus()
    try {
      await fetch('/api/prepack/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ ts: entry.ts, code: entry.code, location: entry.location, note: entry.note }],
        }),
      })
    } catch (error) {
      console.error('Sync error:', error)
    }
  }

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const undoLast = () => {
    setEntries((prev) => prev.slice(1))
  }

  const clearAll = () => {
    if (!confirm('Alles wissen? Dit kan niet ongedaan gemaakt worden.')) return
    setEntries([])
  }

  const exportTSV = () => {
    const header = ['Tijd', 'Barcode', 'Locatie', 'Notitie']
    const lines = [header.join('\t')]
    for (const e of entries) {
      const clean = (v: string) => v.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
      lines.push([clean(e.ts), clean(e.code), clean(e.location), clean(e.note)].join('\t'))
    }
    return lines.join('\n')
  }

  const exportCSV = () => {
    const q = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [['Tijd', 'Barcode', 'Locatie', 'Notitie'].map(q).join(',')]
    for (const e of entries) {
      lines.push([q(e.ts), q(e.code), q(e.location), q(e.note)].join(','))
    }
    return lines.join('\r\n')
  }

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const handleCopyTSV = async () => {
    const text = exportTSV()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      downloadFile('prepack-scans.tsv', text, 'text/tab-separated-values')
    }
  }

  const handleDownloadCSV = () => {
    const csv = exportCSV()
    const stamp = new Date().toISOString().replace(/[:]/g, '-').replace('T', '_').split('.')[0]
    downloadFile(`prepack-scans-${stamp}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prepack Lading</h1>
          <p className="text-sm text-gray-600">
            Scan barcodes en exporteer direct naar Excel/CSV.
          </p>
        </div>
        <div className="flex gap-3">
          <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            Totaal: {totalCount}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
            Uniek: {uniqueCount}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addEntry()
                }
              }}
              placeholder="Scan hier..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
            >
              <option value="3PL">3PL</option>
              <option value="Service center">Service center</option>
              <option value="Powertools">Powertools</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notitie</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optioneel"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={addEntry}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            ➕ Toevoegen
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={beepEnabled}
              onChange={(e) => setBeepEnabled(e.target.checked)}
            />
            Beep
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={focusEnabled}
              onChange={(e) => setFocusEnabled(e.target.checked)}
            />
            Altijd focus
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={timestampEnabled}
              onChange={(e) => setTimestampEnabled(e.target.checked)}
            />
            Tijdstempel
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tijd</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Locatie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Notitie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acties</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nog geen scans.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.ts || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{entry.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.note || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Verwijder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-5">
        <button
          onClick={handleCopyTSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Copy className="w-4 h-4" />
          Kopieer voor Excel (TSV)
        </button>
        <button
          onClick={handleDownloadCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
        <button
          onClick={undoLast}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200"
        >
          <Undo2 className="w-4 h-4" />
          Verwijder laatste
        </button>
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
        >
          <Trash2 className="w-4 h-4" />
          Alles wissen
        </button>
      </div>
    </div>
  )
}
