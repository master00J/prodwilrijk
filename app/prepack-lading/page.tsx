'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  CloudOff,
  Copy,
  Download,
  RefreshCw,
  Trash2,
  Undo2,
  Wifi,
  WifiOff,
} from 'lucide-react'

type Entry = {
  id: string
  /** Stabiele ID waarmee de server idempotent kan upserten. */
  client_id: string
  ts: string
  code: string
  location: string
  note: string
  /** Is deze scan al bevestigd door de server? */
  synced: boolean
}

const STORAGE_KEY = 'prepack_lading_entries_v1'
const SETTINGS_KEY = 'prepack_lading_settings_v1'

/** Hoe vaak automatisch proberen te syncen als we online zijn en er pending items zijn. */
const RETRY_INTERVAL_MS = 15_000

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const createClientId = () => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as Crypto).randomUUID()
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

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
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: Array<Partial<Entry>> = JSON.parse(raw)
        // Migreer oude entries zonder client_id / synced vlag: we markeren ze
        // als nog-niet-gesynced zodat ze alsnog naar de server gaan zodra het
        // netwerk weer up is. Beter één duplicate dan verloren data.
        const migrated: Entry[] = parsed.map((e) => ({
          id: String(e.id || createId()),
          client_id: String(e.client_id || createClientId()),
          ts: String(e.ts ?? ''),
          code: String(e.code ?? ''),
          location: String(e.location ?? ''),
          note: String(e.note ?? ''),
          synced: e.synced === true,
        }))
        setEntries(migrated)
      }
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

  // Persist entries naar localStorage bij elke wijziging — zo blijft alles lokaal
  // beschikbaar, ook zonder netwerk.
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
  const pendingCount = useMemo(() => entries.filter((e) => !e.synced).length, [entries])

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

  /**
   * Probeert alle niet-gesynced entries in één batch naar de server te sturen.
   * Idempotent dankzij client_id: als het server-side al bestaat doet de upsert niets.
   * Wordt stil uitgevoerd (geen throws), status komt via state naar de UI.
   */
  const syncPending = useCallback(async () => {
    if (syncInFlightRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const pending = entries.filter((e) => !e.synced)
    if (pending.length === 0) return

    syncInFlightRef.current = true
    setIsSyncing(true)
    setLastSyncError(null)
    try {
      const res = await fetch('/api/prepack/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: pending.map((e) => ({
            client_id: e.client_id,
            ts: e.ts,
            code: e.code,
            location: e.location,
            note: e.note,
          })),
        }),
      })
      if (!res.ok) {
        const msg = `Server gaf status ${res.status}`
        setLastSyncError(msg)
        return
      }
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      const syncedIds = new Set<string>(
        Array.isArray((data as { synced_client_ids?: string[] }).synced_client_ids)
          ? ((data as { synced_client_ids?: string[] }).synced_client_ids as string[])
          : pending.map((e) => e.client_id)
      )
      setEntries((prev) =>
        prev.map((e) => (syncedIds.has(e.client_id) ? { ...e, synced: true } : e))
      )
    } catch (err) {
      setLastSyncError(err instanceof Error ? err.message : 'Sync mislukt')
    } finally {
      setIsSyncing(false)
      syncInFlightRef.current = false
    }
  }, [entries])

  // Luister naar online/offline en probeer meteen te syncen wanneer het netwerk
  // terugkomt. Een periodieke retry dekt het geval waarin de tablet net niet
  // "online" melding krijgt (slechte wifi-hop) maar de server wel bereikbaar is.
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      void syncPending()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncPending])

  useEffect(() => {
    if (pendingCount === 0) return
    const t = setInterval(() => {
      void syncPending()
    }, RETRY_INTERVAL_MS)
    return () => clearInterval(t)
  }, [pendingCount, syncPending])

  // Bij mount direct één syncpoging doen voor oude entries uit vorige sessie.
  useEffect(() => {
    if (entries.length === 0) return
    void syncPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addEntry = async () => {
    const code = sanitizeCode(barcode)
    if (!code) return
    const ts = timestampEnabled ? formatTimestamp(new Date()) : ''
    const entry: Entry = {
      id: createId(),
      client_id: createClientId(),
      ts,
      code,
      location,
      note: note.trim(),
      synced: false,
    }
    setEntries((prev) => [entry, ...prev])
    setBarcode('')
    playBeep()
    if (focusEnabled) inputRef.current?.focus()

    // Probeer meteen te syncen. Faalt de call (offline, time-out, 5xx) dan blijft
    // de entry met synced=false staan en neemt de retry-loop het later over.
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      const res = await fetch('/api/prepack/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [
            {
              client_id: entry.client_id,
              ts: entry.ts,
              code: entry.code,
              location: entry.location,
              note: entry.note,
            },
          ],
        }),
      })
      if (res.ok) {
        setEntries((prev) =>
          prev.map((e) => (e.client_id === entry.client_id ? { ...e, synced: true } : e))
        )
      } else {
        setLastSyncError(`Server gaf status ${res.status}`)
      }
    } catch (error) {
      // Offline of netwerk-error: retry-loop neemt het over.
      setLastSyncError(error instanceof Error ? error.message : 'Sync mislukt')
    }
  }

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const undoLast = () => {
    setEntries((prev) => prev.slice(1))
  }

  const clearAll = () => {
    const pending = entries.filter((e) => !e.synced).length
    const extra = pending > 0 ? `\n\nLET OP: ${pending} scan(s) zijn nog NIET gesynchroniseerd.` : ''
    if (!confirm(`Alles wissen? Dit kan niet ongedaan gemaakt worden.${extra}`)) return
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prepack Lading</h1>
          <p className="text-sm text-gray-600">
            Scan barcodes en exporteer direct naar Excel/CSV. Werkt ook offline — scans worden
            automatisch gesynchroniseerd zodra er weer internet is.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            Totaal: {totalCount}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
            Uniek: {uniqueCount}
          </span>
        </div>
      </div>

      {/* Sync-status banner */}
      <div
        className={`mb-6 rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm ${
          !isOnline
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : pendingCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Wifi className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="font-medium">
            {!isOnline
              ? 'Geen internetverbinding'
              : pendingCount > 0
                ? `${pendingCount} scan${pendingCount === 1 ? '' : 's'} nog niet gesynchroniseerd`
                : 'Alles gesynchroniseerd'}
          </span>
          {!isOnline && pendingCount > 0 && (
            <span className="text-amber-800">
              · {pendingCount} scan{pendingCount === 1 ? '' : 's'} wachten op netwerk
            </span>
          )}
          {lastSyncError && (
            <span className="text-xs text-gray-500 truncate" title={lastSyncError}>
              · laatste fout: {lastSyncError}
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => void syncPending()}
            disabled={isSyncing || !isOnline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white border border-current/20 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Bezig…' : 'Sync nu'}
          </button>
        )}
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase w-10">
                  <span className="sr-only">Sync</span>
                </th>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nog geen scans.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-gray-50 ${!entry.synced ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-3 py-3 text-center">
                      {entry.synced ? (
                        <span title="Gesynchroniseerd">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        </span>
                      ) : (
                        <span title="Nog niet gesynchroniseerd">
                          <CloudOff className="w-4 h-4 text-amber-500 mx-auto" />
                        </span>
                      )}
                    </td>
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
