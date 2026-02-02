'use client'

import { useEffect, useRef, useState } from 'react'

interface ScanCheckAirtecProps {
  onMatch: (lotNumber: string) => Promise<void>
}

type ScanStatus = 'idle' | 'match' | 'mismatch' | 'error'

const normalizeLot = (value: string) => {
  const cleaned = value.replace(/[\r\n\t]/g, '').trim().toUpperCase()
  if (!cleaned) return ''
  return cleaned.replace(/^(2W|S)/, '')
}

export default function ScanCheckAirtec({ onMatch }: ScanCheckAirtecProps) {
  const [scanA, setScanA] = useState('')
  const [scanB, setScanB] = useState('')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const inputARef = useRef<HTMLInputElement>(null)
  const inputBRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputARef.current?.focus()
  }, [])

  const reset = (focusFirst = true) => {
    setScanA('')
    setScanB('')
    setStatus('idle')
    setMessage(null)
    if (focusFirst) {
      setTimeout(() => inputARef.current?.focus(), 0)
    }
  }

  const MATCH_DISPLAY_MS = 2200
  const MISMATCH_DISPLAY_MS = 2800
  const ERROR_DISPLAY_MS = 3500

  const handleScanAChange = (value: string) => {
    if (/[\r\n\t]/.test(value)) {
      const cleaned = value.replace(/[\r\n\t]/g, '')
      setScanA(cleaned)
      setTimeout(() => inputBRef.current?.focus(), 0)
      return
    }
    setScanA(value)
  }

  const handleScanAKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (scanA.trim()) {
        setTimeout(() => inputBRef.current?.focus(), 0)
      }
    }
  }

  const handleCompare = async () => {
    if (status !== 'idle') return
    const a = normalizeLot(scanA)
    const b = normalizeLot(scanB)
    if (!a || !b) return

    if (a === b) {
      setStatus('match')
      setMessage(`Match: ${a}`)
      try {
        await onMatch(a)
        setTimeout(() => reset(true), MATCH_DISPLAY_MS)
      } catch (error: any) {
        setStatus('error')
        setMessage(error?.message || 'Kon lotnummer niet verplaatsen')
        setTimeout(() => reset(true), ERROR_DISPLAY_MS)
      }
      return
    }

    setStatus('mismatch')
    setMessage(`Mismatch: "${a}" ≠ "${b}"`)
    setTimeout(() => {
      setScanB('')
      setStatus('idle')
      setMessage(null)
      inputBRef.current?.focus()
    }, MISMATCH_DISPLAY_MS)
  }

  useEffect(() => {
    if (status !== 'idle') return
    if (scanA.trim() && scanB.trim()) {
      void handleCompare()
    }
  }, [scanA, scanB, status])

  const overlayClass =
    status === 'match'
      ? 'bg-green-500/90'
      : status === 'mismatch' || status === 'error'
      ? 'bg-red-500/90'
      : ''

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6 relative">
      {(status === 'match' || status === 'mismatch' || status === 'error') && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center text-white text-4xl font-bold ${overlayClass}`}
          aria-live="assertive"
        >
          {status === 'match' ? 'OK' : 'FOUT'}
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Scan controle (Lot Number)</h2>
        <button
          onClick={() => reset(true)}
          className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          ref={inputARef}
          type="text"
          value={scanA}
          onChange={(e) => handleScanAChange(e.target.value)}
          onKeyDown={handleScanAKeyDown}
          disabled={status !== 'idle'}
          placeholder="Scan 1 (Lot Number)"
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        <input
          ref={inputBRef}
          type="text"
          value={scanB}
          onChange={(e) => setScanB(e.target.value)}
          disabled={status !== 'idle'}
          placeholder="Scan 2 (Lot Number)"
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
      </div>
      <div
        className={`rounded-lg px-4 py-3 text-lg font-semibold ${
          status === 'match'
            ? 'bg-green-100 text-green-700'
            : status === 'mismatch'
            ? 'bg-red-100 text-red-700'
            : status === 'error'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-gray-50 text-gray-500'
        }`}
      >
        {message || 'Scan twee keer hetzelfde lotnummer om te bevestigen.'}
      </div>
    </div>
  )
}
