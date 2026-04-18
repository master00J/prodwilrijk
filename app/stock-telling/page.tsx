'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { useAuth } from '@/components/AuthProvider'

interface Session {
  id: number
  name: string
  status: 'open' | 'closed'
  created_at: string
  created_by: string | null
  closed_at: string | null
  note: string | null
}

interface Scan {
  id: number
  session_id: number
  item_number: string
  pallet_number: string | null
  quantity: number
  description: string | null
  label_type: string | null
  source: string
  raw_label: Record<string, unknown> | null
  photo_data_url: string | null
  note: string | null
  duplicate_of: number | null
  scanned_at: string
  scanned_by: string | null
}

interface ExtractedLabel {
  item_number: string | null
  quantity: number | null
  pallet_number: string | null
  description: string | null
  po_line: string | null
  location: string | null
  shop_order: string | null
  date: string | null
  label_type: string
  raw_text_hint: string | null
}

type QueueStatus = 'pending' | 'processing' | 'done' | 'error' | 'duplicate' | 'needs_review'

interface QueueItem {
  id: string
  preview: string
  base64: string
  mediaType: string
  status: QueueStatus
  label: ExtractedLabel | null
  error: string | null
  info: string | null
  existing: Array<Pick<Scan, 'id' | 'item_number' | 'pallet_number' | 'quantity' | 'scanned_at'>>
  pendingPayload: {
    item_number: string
    pallet_number: string | null
    quantity: number
    description: string | null
    label_type: string | null
  } | null
}

let queueIdCounter = 0

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('nl-BE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('nl-BE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function StockTellingPage() {
  const { user } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualItem, setManualItem] = useState('')
  const [manualPallet, setManualPallet] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const [search, setSearch] = useState('')
  const [globalError, setGlobalError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  // ——— Load/poll session + scans ————————————————————————————————————————
  const refreshScans = useCallback(async (sessionId: number) => {
    try {
      const res = await fetch(`/api/stock-count/sessions/${sessionId}/scans`)
      if (!res.ok) return
      const data = (await res.json()) as { scans: Scan[] }
      setScans(data.scans || [])
    } catch {
      /* stil */
    }
  }, [])

  const loadActive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stock-count/sessions/active')
      if (!res.ok) throw new Error(`Fout bij laden (${res.status})`)
      const data = (await res.json()) as { session: Session | null }
      setSession(data.session)
      if (data.session) {
        await refreshScans(data.session.id)
      } else {
        setScans([])
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [refreshScans])

  useEffect(() => {
    loadActive()
  }, [loadActive])

  // Periodiek refreshen zodat andere toestellen live blijven synchroniseren
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => {
      refreshScans(session.id)
    }, 7000)
    return () => clearInterval(t)
  }, [session, refreshScans])

  // ——— Camera ——————————————————————————————————————————————————————————
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      setCameraError('Camera kon niet geopend worden. Gebruik de knop "Foto uit bestand" hieronder.')
      setCameraActive(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // ——— Session acties —————————————————————————————————————————————————
  const startNewSession = useCallback(async () => {
    const name = window.prompt(
      'Naam voor deze telling:',
      `Telling ${new Date().toLocaleDateString('nl-BE')}`
    )
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/stock-count/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, created_by: user?.email ?? null }),
      })
      if (!res.ok) throw new Error(`Aanmaken mislukt (${res.status})`)
      await loadActive()
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Sessie aanmaken mislukt')
    } finally {
      setBusy(false)
    }
  }, [loadActive, user])

  const closeSession = useCallback(async () => {
    if (!session) return
    if (!window.confirm(`Telling "${session.name}" afsluiten?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/stock-count/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      if (!res.ok) throw new Error(`Afsluiten mislukt (${res.status})`)
      await loadActive()
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Afsluiten mislukt')
    } finally {
      setBusy(false)
    }
  }, [session, loadActive])

  // ——— Capture & upload flow ———————————————————————————————————————————
  const enqueueImage = useCallback((base64: string, dataUrl: string, mediaType: string) => {
    const id = `q-${++queueIdCounter}-${Date.now()}`
    setQueue((prev) => [
      {
        id,
        preview: dataUrl,
        base64,
        mediaType,
        status: 'pending',
        label: null,
        error: null,
        info: null,
        existing: [],
        pendingPayload: null,
      },
      ...prev,
    ])
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    const base64 = dataUrl.split(',')[1]
    enqueueImage(base64, dataUrl, 'image/jpeg')
  }, [enqueueImage])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      enqueueImage(base64, dataUrl, file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [enqueueImage])

  const submitScan = useCallback(
    async (
      sessionId: number,
      payload: {
        item_number: string
        pallet_number: string | null
        quantity: number
        description: string | null
        label_type: string | null
        source: 'camera' | 'manual' | 'edit'
        raw_label: unknown
        force?: boolean
      }
    ) => {
      const res = await fetch(`/api/stock-count/sessions/${sessionId}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, scanned_by: user?.email ?? null }),
      })
      if (res.status === 409) {
        const data = (await res.json()) as {
          duplicate: boolean
          existing: Scan[]
        }
        return { duplicate: true as const, existing: data.existing }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Opslaan mislukt (${res.status})`)
      }
      const data = (await res.json()) as { scan: Scan }
      return { duplicate: false as const, scan: data.scan }
    },
    [user]
  )

  const processItem = useCallback(
    async (item: QueueItem) => {
      if (!session) return
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: 'processing' } : q)))
      try {
        const res = await fetch('/api/stock-count/extract-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: item.base64, mediaType: item.mediaType }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Label lezen mislukt (${res.status})`)
        }
        const data = (await res.json()) as { label: ExtractedLabel }
        const label = data.label

        if (!label.item_number) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'needs_review', label, error: 'Geen itemnummer gelezen' }
                : q
            )
          )
          return
        }

        const payload = {
          item_number: label.item_number,
          pallet_number: label.pallet_number,
          quantity: label.quantity ?? 1,
          description: label.description,
          label_type: label.label_type,
        }

        const result = await submitScan(session.id, {
          ...payload,
          source: 'camera',
          raw_label: label,
        })

        if (result.duplicate) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'duplicate',
                    label,
                    existing: result.existing,
                    pendingPayload: payload,
                    error: null,
                    info: `Al gescand: ${label.item_number}${
                      label.pallet_number ? ' / pallet ' + label.pallet_number : ''
                    }`,
                  }
                : q
            )
          )
        } else {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'done',
                    label,
                    info: `Toegevoegd: ${label.item_number} × ${payload.quantity}${
                      label.pallet_number ? ' (pallet ' + label.pallet_number + ')' : ''
                    }`,
                  }
                : q
            )
          )
          await refreshScans(session.id)
        }
      } catch (err: unknown) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Mislukt',
                }
              : q
          )
        )
      }
    },
    [session, submitScan, refreshScans]
  )

  // Sequentieel afhandelen van queue
  useEffect(() => {
    if (processingRef.current) return
    const next = queue.find((q) => q.status === 'pending')
    if (!next) return
    processingRef.current = true
    processItem(next).finally(() => {
      processingRef.current = false
      setQueue((prev) => [...prev])
    })
  }, [queue, processItem])

  const handleForceAdd = useCallback(
    async (qItem: QueueItem) => {
      if (!session || !qItem.pendingPayload) return
      setQueue((prev) =>
        prev.map((q) => (q.id === qItem.id ? { ...q, status: 'processing' } : q))
      )
      try {
        const result = await submitScan(session.id, {
          ...qItem.pendingPayload,
          source: 'camera',
          raw_label: qItem.label,
          force: true,
        })
        if (result.duplicate) throw new Error('Dubbele scan nog altijd geweigerd')
        setQueue((prev) =>
          prev.map((q) =>
            q.id === qItem.id
              ? {
                  ...q,
                  status: 'done',
                  info: 'Toch toegevoegd als extra regel',
                }
              : q
          )
        )
        await refreshScans(session.id)
      } catch (err: unknown) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === qItem.id
              ? { ...q, status: 'error', error: err instanceof Error ? err.message : 'Mislukt' }
              : q
          )
        )
      }
    },
    [session, submitScan, refreshScans]
  )

  const handleSkipDuplicate = useCallback((qItem: QueueItem) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === qItem.id ? { ...q, status: 'done', info: 'Overgeslagen (duplicaat)' } : q))
    )
  }, [])

  // ——— Manueel toevoegen —————————————————————————————————————————————
  const submitManual = useCallback(async () => {
    if (!session) return
    const item = manualItem.trim()
    if (!item) {
      setGlobalError('Itemnummer is verplicht')
      return
    }
    const qty = Math.max(0, Math.trunc(Number(manualQty) || 0))
    const pallet = manualPallet.trim() || null
    setBusy(true)
    try {
      const result = await submitScan(session.id, {
        item_number: item,
        pallet_number: pallet,
        quantity: qty,
        description: null,
        label_type: null,
        source: 'manual',
        raw_label: null,
      })
      if (result.duplicate) {
        const confirmed = window.confirm(
          `Deze combinatie (${item}${pallet ? ' / ' + pallet : ''}) is al gescand. Toch extra toevoegen?`
        )
        if (!confirmed) {
          setBusy(false)
          return
        }
        await submitScan(session.id, {
          item_number: item,
          pallet_number: pallet,
          quantity: qty,
          description: null,
          label_type: null,
          source: 'manual',
          raw_label: null,
          force: true,
        })
      }
      setManualItem('')
      setManualPallet('')
      setManualQty('1')
      await refreshScans(session.id)
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Manuele scan mislukt')
    } finally {
      setBusy(false)
    }
  }, [session, manualItem, manualPallet, manualQty, submitScan, refreshScans])

  // ——— Scan acties (edit/delete) ——————————————————————————————————————
  const updateScan = useCallback(
    async (scan: Scan, patch: Partial<Pick<Scan, 'item_number' | 'pallet_number' | 'quantity' | 'note'>>) => {
      try {
        const res = await fetch(`/api/stock-count/scans/${scan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(`Bewerken mislukt (${res.status})`)
        if (session) await refreshScans(session.id)
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : 'Bewerken mislukt')
      }
    },
    [session, refreshScans]
  )

  const deleteScan = useCallback(
    async (scan: Scan) => {
      if (!window.confirm(`Scan ${scan.item_number}${scan.pallet_number ? ' / ' + scan.pallet_number : ''} verwijderen?`)) return
      try {
        const res = await fetch(`/api/stock-count/scans/${scan.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Verwijderen mislukt (${res.status})`)
        if (session) await refreshScans(session.id)
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : 'Verwijderen mislukt')
      }
    },
    [session, refreshScans]
  )

  // ——— Statistieken ————————————————————————————————————————————————————
  const stats = useMemo(() => {
    const uniquePairs = new Set<string>()
    const uniqueItems = new Set<string>()
    let totalQty = 0
    let duplicates = 0
    for (const s of scans) {
      totalQty += s.quantity
      uniqueItems.add(s.item_number)
      uniquePairs.add(`${s.item_number}\t${s.pallet_number ?? ''}`)
      if (s.duplicate_of !== null) duplicates += 1
    }
    return {
      totalScans: scans.length,
      uniquePairs: uniquePairs.size,
      uniqueItems: uniqueItems.size,
      totalQty,
      duplicates,
    }
  }, [scans])

  const visibleScans = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scans
    return scans.filter(
      (s) =>
        s.item_number.toLowerCase().includes(q) ||
        (s.pallet_number ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    )
  }, [scans, search])

  // ——— Excel export —————————————————————————————————————————————————————
  const exportExcel = useCallback(() => {
    if (!session || scans.length === 0) return

    // Tabblad 1: alle scans (chronologisch)
    const allAoa: (string | number)[][] = [
      ['Itemnummer', 'Palletnummer', 'Aantal', 'Omschrijving', 'Label-type', 'Bron', 'Gescand op', 'Door', 'Duplicaat van'],
    ]
    for (const s of scans) {
      allAoa.push([
        s.item_number,
        s.pallet_number ?? '',
        s.quantity,
        s.description ?? '',
        s.label_type ?? '',
        s.source,
        formatDateTime(s.scanned_at),
        s.scanned_by ?? '',
        s.duplicate_of ?? '',
      ])
    }
    const wsAll = XLSX.utils.aoa_to_sheet(allAoa)
    wsAll['!cols'] = [
      { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
    ]

    // Tabblad 2: aggregatie per (item, pallet)
    const aggMap = new Map<string, { item: string; pallet: string; qty: number; scans: number; lastAt: string }>()
    for (const s of scans) {
      const key = `${s.item_number}\t${s.pallet_number ?? ''}`
      const ex = aggMap.get(key)
      if (ex) {
        ex.qty += s.quantity
        ex.scans += 1
        if (s.scanned_at > ex.lastAt) ex.lastAt = s.scanned_at
      } else {
        aggMap.set(key, {
          item: s.item_number,
          pallet: s.pallet_number ?? '',
          qty: s.quantity,
          scans: 1,
          lastAt: s.scanned_at,
        })
      }
    }
    const aggRows = Array.from(aggMap.values()).sort((a, b) =>
      a.item === b.item ? a.pallet.localeCompare(b.pallet) : a.item.localeCompare(b.item)
    )
    const aggAoa: (string | number)[][] = [
      ['Itemnummer', 'Palletnummer', 'Aantal (som)', 'Scans', 'Laatst gescand'],
    ]
    for (const r of aggRows) {
      aggAoa.push([r.item, r.pallet, r.qty, r.scans, formatDateTime(r.lastAt)])
    }
    const wsAgg = XLSX.utils.aoa_to_sheet(aggAoa)
    wsAgg['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 18 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsAgg, 'Overzicht')
    XLSX.utils.book_append_sheet(wb, wsAll, 'Alle scans')

    const safe = session.name.replace(/[^a-z0-9_\-]+/gi, '-').slice(0, 40) || 'telling'
    XLSX.writeFile(wb, `stock-telling_${safe}.xlsx`)
  }, [session, scans])

  // ——— Render ——————————————————————————————————————————————————————————
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">Laden…</div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            ← Home
          </Link>
          <Link
            href="/admin"
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Admin
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Stock telling</h1>
        <p className="text-sm text-gray-600 mb-4">
          Scan pallet-labels met de camera. Itemnummer, palletnummer en aantal worden automatisch
          herkend en aan de telling toegevoegd. Dubbele combinaties krijgen een waarschuwing.
        </p>

        {globalError && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm flex items-start justify-between gap-3">
            <span>{globalError}</span>
            <button
              className="text-red-600 underline"
              onClick={() => setGlobalError(null)}
              type="button"
            >
              sluit
            </button>
          </div>
        )}

        {/* Sessie kaart */}
        {!session ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-indigo-900 mb-2">Geen actieve telling</h2>
            <p className="text-sm text-indigo-800 mb-4">Start een nieuwe telsessie om scans te kunnen opslaan.</p>
            <button
              type="button"
              onClick={startNewSession}
              disabled={busy}
              className="px-5 py-2.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Nieuwe telling starten
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    OPEN
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">{session.name}</h2>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Gestart {formatDateTime(session.created_at)}
                  {session.created_by ? ` door ${session.created_by}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={scans.length === 0}
                  className="px-3 py-1.5 text-sm rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={closeSession}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                >
                  Afsluiten
                </button>
                <button
                  type="button"
                  onClick={startNewSession}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                >
                  Nieuw
                </button>
              </div>
            </div>

            {/* Statistieken */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
              <Stat label="Scans" value={stats.totalScans} />
              <Stat label="Uniek item+pallet" value={stats.uniquePairs} />
              <Stat label="Unieke items" value={stats.uniqueItems} />
              <Stat label="Totaal aantal" value={stats.totalQty} />
              <Stat label="Duplicaten" value={stats.duplicates} tone={stats.duplicates > 0 ? 'warn' : undefined} />
            </div>
          </div>
        )}

        {session && (
          <>
            {/* Camera blok */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Camera</h3>
                <div className="flex gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Camera starten
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      Stoppen
                    </button>
                  )}
                </div>
              </div>

              <div className="relative rounded-lg overflow-hidden bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full ${cameraActive ? 'block' : 'hidden'}`}
                  style={{ maxHeight: '40vh', objectFit: 'cover' }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureFrame}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-indigo-500 shadow-lg active:scale-90 transition-transform flex items-center justify-center"
                    aria-label="Foto nemen"
                  >
                    <div className="w-12 h-12 bg-indigo-500 rounded-full" />
                  </button>
                )}

                {!cameraActive && (
                  <div className="py-10 flex items-center justify-center text-gray-400 text-sm">
                    Camera staat uit
                  </div>
                )}
              </div>

              {/* Fallback: bestand kiezen */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  Foto uit bestand
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  {showManual ? 'Manueel sluiten' : 'Manueel invoeren'}
                </button>
                {cameraError && <span className="text-xs text-amber-600">{cameraError}</span>}
              </div>

              {/* Manueel invoeren */}
              {showManual && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Itemnummer</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={manualItem}
                      onChange={(e) => setManualItem(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="bv. 1830162496"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Palletnummer</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={manualPallet}
                      onChange={(e) => setManualPallet(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="bv. 556248"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Aantal</label>
                    <input
                      type="number"
                      min={0}
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={submitManual}
                    disabled={busy}
                    className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Toevoegen
                  </button>
                </div>
              )}

              {/* Scan queue */}
              {queue.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[50vh] overflow-auto">
                  {queue.map((q) => (
                    <QueueCard
                      key={q.id}
                      item={q}
                      onForceAdd={() => void handleForceAdd(q)}
                      onSkip={() => handleSkipDuplicate(q)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Scanlijst */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="font-semibold text-gray-800">Gescande pallets</h3>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Zoek item of pallet…"
                  className="ml-auto w-full sm:w-56 px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {visibleScans.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Nog geen scans in deze telling.</p>
              ) : (
                <div className="overflow-auto max-h-[55vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Tijd</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Pallet</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Aantal</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Omschrijving</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Bron</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleScans.map((s) => (
                        <ScanRow
                          key={s.id}
                          scan={s}
                          onUpdate={(patch) => void updateScan(s, patch)}
                          onDelete={() => void deleteScan(s)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warn'
}) {
  const toneClass = tone === 'warn' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

function QueueCard({
  item,
  onForceAdd,
  onSkip,
}: {
  item: QueueItem
  onForceAdd: () => void
  onSkip: () => void
}) {
  const tone =
    item.status === 'done'
      ? 'bg-emerald-50 border-emerald-200'
      : item.status === 'error'
      ? 'bg-red-50 border-red-200'
      : item.status === 'duplicate'
      ? 'bg-amber-50 border-amber-200'
      : item.status === 'needs_review'
      ? 'bg-amber-50 border-amber-200'
      : 'bg-gray-50 border-gray-200'

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${tone}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.preview} alt="" className="w-12 h-12 rounded object-cover opacity-80" />
      <div className="flex-1 min-w-0">
        {item.status === 'pending' && <p className="text-sm text-gray-600">In wachtrij…</p>}
        {item.status === 'processing' && (
          <p className="text-sm text-indigo-700 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
            Label lezen…
          </p>
        )}
        {item.label && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900 text-sm">{item.label.item_number || '?'}</span>
            {item.label.pallet_number && (
              <span className="font-mono text-xs text-gray-600">pallet {item.label.pallet_number}</span>
            )}
            <span className="text-gray-400">×</span>
            <span className="font-semibold text-gray-700 text-sm">{item.label.quantity ?? '?'}</span>
            {item.label.description && (
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{item.label.description}</span>
            )}
          </div>
        )}
        {item.info && <p className="text-xs text-emerald-700 mt-1">{item.info}</p>}
        {item.error && <p className="text-xs text-red-700 mt-1">{item.error}</p>}

        {item.status === 'duplicate' && (
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-amber-800">
              Al gescand. Laatste keer:{' '}
              {item.existing[0] ? formatTime(item.existing[0].scanned_at) : '?'}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Overslaan
            </button>
            <button
              type="button"
              onClick={onForceAdd}
              className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
            >
              Toch toevoegen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ScanRow({
  scan,
  onUpdate,
  onDelete,
}: {
  scan: Scan
  onUpdate: (patch: Partial<Pick<Scan, 'item_number' | 'pallet_number' | 'quantity' | 'note'>>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [item, setItem] = useState(scan.item_number)
  const [pallet, setPallet] = useState(scan.pallet_number ?? '')
  const [qty, setQty] = useState(String(scan.quantity))

  useEffect(() => {
    setItem(scan.item_number)
    setPallet(scan.pallet_number ?? '')
    setQty(String(scan.quantity))
  }, [scan])

  const save = () => {
    onUpdate({
      item_number: item.trim(),
      pallet_number: pallet.trim() || null,
      quantity: Math.max(0, Math.trunc(Number(qty) || 0)),
    })
    setEditing(false)
  }

  return (
    <tr
      className={`border-t border-gray-100 ${scan.duplicate_of ? 'bg-amber-50' : ''}`}
    >
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatTime(scan.scanned_at)}</td>
      <td className="px-3 py-2 font-mono text-xs">
        {editing ? (
          <input
            className="w-28 px-1 py-0.5 border rounded text-xs"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
        ) : (
          scan.item_number
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {editing ? (
          <input
            className="w-20 px-1 py-0.5 border rounded text-xs"
            value={pallet}
            onChange={(e) => setPallet(e.target.value)}
          />
        ) : (
          scan.pallet_number ?? <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <input
            type="number"
            className="w-16 px-1 py-0.5 border rounded text-xs text-right"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        ) : (
          scan.quantity
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[220px]">
        {scan.description ?? ''}
      </td>
      <td className="px-3 py-2 text-xs">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            scan.source === 'manual'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {scan.source}
        </span>
        {scan.duplicate_of && (
          <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
            dup
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {editing ? (
          <>
            <button onClick={save} className="text-xs text-emerald-700 mr-2">opslaan</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">annuleer</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 mr-2">bewerk</button>
            <button onClick={onDelete} className="text-xs text-red-600">verwijder</button>
          </>
        )}
      </td>
    </tr>
  )
}
