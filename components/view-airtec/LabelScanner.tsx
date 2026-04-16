'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ScanMatch {
  id: number
  item_number: string | null
  beschrijving: string | null
  quantity: number
  lot_number: string | null
  kistnummer: string | null
}

interface ScanResultData {
  label: {
    item_number: string | null
    quantity: number | null
    description: string | null
    serial_numbers: string[]
    label_type?: 'airtec' | 'cooler' | 'unknown'
  }
  matches: ScanMatch[]
  warning: string | null
  kistnummer?: string | null
}

type QueueItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'action_needed'

interface QueueItem {
  id: string
  preview: string
  status: QueueItemStatus
  result: ScanResultData | null
  error: string | null
  autoAction: string | null
  base64: string
  mediaType: string
}

interface LabelScannerProps {
  onItemsMatched: (ids: number[]) => void
  onConfirmScanned: () => void
  onUnlistedAdded: () => void
  onIncomingAdded?: () => void
}

function normalizeItemNumber(raw: string): string {
  return raw.replace(/[\s\-\.]/g, '').toUpperCase()
}

let queueIdCounter = 0

export default function LabelScanner({ onItemsMatched, onConfirmScanned, onUnlistedAdded, onIncomingAdded }: LabelScannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [scanTally, setScanTally] = useState<Record<string, { scanned: number; inList: number }>>({})
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const processingRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doneCount = queue.filter(q => q.status === 'done').length
  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'processing').length
  const actionCount = queue.filter(q => q.status === 'action_needed').length
  const matchedCount = queue.filter(q => q.status === 'done' && q.result && q.result.matches.length > 0).length

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
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
      setCameraError('Camera kon niet geopend worden. Gebruik de knop hieronder om een foto te selecteren.')
      setCameraActive(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]
    const id = `scan-${++queueIdCounter}-${Date.now()}`

    setQueue(prev => [{ id, preview: dataUrl, status: 'pending', result: null, error: null, autoAction: null, base64, mediaType: 'image/jpeg' }, ...prev])
  }, [])

  const handleFileCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type || 'image/jpeg'
      const id = `scan-${++queueIdCounter}-${Date.now()}`

      setQueue(prev => [{ id, preview: dataUrl, status: 'pending', result: null, error: null, autoAction: null, base64, mediaType }, ...prev])
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const addCoolerToIncoming = useCallback(async (queueId: string, data: ScanResultData) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/incoming-goods-airtec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschrijving: 'cooler',
          item_number: data.label.item_number,
          lot_number: null,
          datum_opgestuurd: today,
          kistnummer: data.kistnummer || null,
          divisie: null,
          quantity: data.label.quantity || 1,
        }),
      })

      if (!res.ok) throw new Error('Toevoegen mislukt')

      onIncomingAdded?.()
      setQueue(prev => prev.map(q => q.id === queueId ? {
        ...q,
        status: 'done' as const,
        result: data,
        autoAction: `Cooler toegevoegd${data.kistnummer ? ` (kist: ${data.kistnummer})` : ''}`,
      } : q))
    } catch {
      setQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'action_needed', result: data, autoAction: null } : q))
    }
  }, [onIncomingAdded])

  const processItem = useCallback(async (item: QueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' as const } : q))

    try {
      const res = await fetch('/api/incoming-goods-airtec/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: item.base64, mediaType: item.mediaType }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Scan mislukt (${res.status})`)
      }

      const data: ScanResultData = await res.json()

      // Cooler labels: auto-add to incoming goods (main list)
      if (data.label.label_type === 'cooler' && data.label.item_number) {
        await addCoolerToIncoming(item.id, data)
        return
      }

      if (data.matches.length > 0 && data.label.item_number) {
        const key = normalizeItemNumber(data.label.item_number)
        const listTotal = data.matches.reduce((sum, m) => sum + m.quantity, 0)
        const labelQty = data.label.quantity || 1

        let isExtra = false
        setScanTally(prev => {
          const existing = prev[key] || { scanned: 0, inList: listTotal }
          const newScanned = existing.scanned + labelQty
          isExtra = newScanned > listTotal
          return { ...prev, [key]: { scanned: newScanned, inList: listTotal } }
        })

        await new Promise(r => setTimeout(r, 0))

        if (isExtra) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'action_needed', result: data, autoAction: null } : q))
        } else {
          onItemsMatched(data.matches.map(m => m.id))
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', result: data, autoAction: `${data.matches.length} item(s) geselecteerd` } : q))
        }
        return
      }

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'action_needed', result: data, autoAction: null } : q))
    } catch (err: any) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message || 'Scan mislukt' } : q))
    }
  }, [onItemsMatched, addCoolerToIncoming])

  useEffect(() => {
    if (processingRef.current) return
    const next = queue.find(q => q.status === 'pending')
    if (!next) return

    processingRef.current = true
    processItem(next).finally(() => {
      processingRef.current = false
    })
  }, [queue, processItem])

  const handleAddToUnlisted = useCallback(async (queueId: string) => {
    const item = queue.find(q => q.id === queueId)
    if (!item?.result?.label) return

    setQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'processing' } : q))

    try {
      const label = item.result.label
      const serialStr = label.serial_numbers.length > 0
        ? label.serial_numbers.join(', ')
        : null
      const key = label.item_number ? normalizeItemNumber(label.item_number) : null
      const tally = key ? scanTally[key] : null

      await fetch('/api/incoming-goods-airtec/unlisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschrijving: label.description || label.item_number || 'Onbekend',
          item_number: label.item_number,
          lot_number: serialStr,
          datum_opgestuurd: null,
          kistnummer: null,
          divisie: null,
          quantity: label.quantity || 1,
          opmerking: tally
            ? `Extra pallet — ${tally.scanned} gescand, ${tally.inList} in verzendnota`
            : 'Toegevoegd via label scan — niet in verzendnota',
        }),
      })
      onUnlistedAdded()
      setQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'done', autoAction: 'Toegevoegd aan niet-in-lijst' } : q))
    } catch {
      setQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'action_needed' } : q))
    }
  }, [queue, scanTally, onUnlistedAdded])

  const handleClose = () => {
    stopCamera()
    setIsOpen(false)
    setQueue([])
    setScanTally({})
    setCameraError(null)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => startCamera(), 100) }}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Scan Label
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-800">Label Scanner</h3>
          {doneCount > 0 && (
            <span className="bg-green-100 text-green-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {doneCount} verwerkt
            </span>
          )}
          {pendingCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-sm font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              {pendingCount} bezig
            </span>
          )}
          {actionCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {actionCount} actie nodig
            </span>
          )}
        </div>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Live camera viewfinder */}
      <div className="relative mb-4 rounded-xl overflow-hidden bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full ${cameraActive ? 'block' : 'hidden'}`}
          style={{ maxHeight: '35vh', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {cameraActive && (
          <button
            onClick={captureFrame}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-indigo-500 shadow-lg active:scale-90 transition-transform flex items-center justify-center"
          >
            <div className="w-12 h-12 bg-indigo-500 rounded-full" />
          </button>
        )}

        {!cameraActive && !cameraError && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Camera starten...</p>
          </div>
        )}
      </div>

      {/* Camera error fallback */}
      {cameraError && (
        <div className="mb-4">
          <p className="text-sm text-amber-600 mb-2">{cameraError}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileCapture}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium text-lg shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Maak een foto
          </button>
        </div>
      )}

      {/* Confirm all matched button */}
      {matchedCount > 0 && (
        <button
          onClick={onConfirmScanned}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Bevestig alle gescande items
        </button>
      )}

      {/* Results feed */}
      {queue.length > 0 && (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {queue.map(item => (
            <ScanCard
              key={item.id}
              item={item}
              onAddToUnlisted={() => handleAddToUnlisted(item.id)}
            />
          ))}
        </div>
      )}

      {queue.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-2">Richt de camera op een label en druk op de knop</p>
      )}
    </div>
  )
}

function ScanCard({ item, onAddToUnlisted }: { item: QueueItem; onAddToUnlisted: () => void }) {
  const label = item.result?.label

  const statusConfig = {
    pending: { bg: 'bg-gray-50 border-gray-200', icon: 'waiting' as const },
    processing: { bg: 'bg-indigo-50 border-indigo-200', icon: 'spinning' as const },
    done: { bg: 'bg-green-50 border-green-200', icon: 'check' as const },
    error: { bg: 'bg-red-50 border-red-200', icon: 'error' as const },
    action_needed: { bg: 'bg-amber-50 border-amber-200', icon: 'warning' as const },
  }

  const config = statusConfig[item.status]

  return (
    <div className={`rounded-lg border p-3 ${config.bg} transition-all`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="shrink-0 mt-0.5">
          {config.icon === 'spinning' && (
            <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          )}
          {config.icon === 'waiting' && (
            <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
          )}
          {config.icon === 'check' && (
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {config.icon === 'error' && (
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {config.icon === 'warning' && (
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {(item.status === 'pending' || item.status === 'processing') && !label && (
            <p className="text-sm text-gray-600">
              {item.status === 'pending' ? 'In wachtrij...' : 'Label analyseren...'}
            </p>
          )}

          {item.status === 'error' && (
            <p className="text-sm text-red-600 font-medium">{item.error}</p>
          )}

          {label && (
            <div className="flex items-center gap-2 flex-wrap">
              {label.label_type === 'cooler' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Cooler</span>
              )}
              <span className="font-mono font-bold text-gray-900 text-sm">{label.item_number || '?'}</span>
              <span className="text-gray-400">&times;</span>
              <span className="font-bold text-gray-700 text-sm">{label.quantity ?? '?'}</span>
              {label.description && (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">{label.description}</span>
              )}
              {label.serial_numbers.length > 0 && (
                <span className="text-xs text-gray-400">({label.serial_numbers.length} AIA nrs)</span>
              )}
            </div>
          )}

          {item.autoAction && item.status === 'done' && (
            <p className="text-xs text-green-600 font-medium mt-0.5">{item.autoAction}</p>
          )}

          {item.result?.warning && item.status !== 'done' && (
            <p className="text-xs text-amber-600 mt-0.5">{item.result.warning}</p>
          )}

          {item.status === 'action_needed' && label && (
            <div className="mt-2">
              {item.result?.matches && item.result.matches.length > 0 ? (
                <button
                  onClick={onAddToUnlisted}
                  className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                >
                  Extra pallet &rarr; Niet in lijst
                </button>
              ) : (
                <button
                  onClick={onAddToUnlisted}
                  className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                >
                  Toevoegen aan Niet in lijst
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.preview} alt="" className="w-10 h-10 rounded object-cover shrink-0 opacity-60" />
      </div>
    </div>
  )
}
