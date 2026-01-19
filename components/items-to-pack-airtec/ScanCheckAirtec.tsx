'use client'

import { useEffect, useRef, useState } from 'react'

interface ScanCheckAirtecProps {
  onMatch: (lotNumber: string) => Promise<void>
}

type ScanStatus = 'idle' | 'match' | 'mismatch' | 'error'

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

  const handleCompare = async () => {
    const a = scanA.trim()
    const b = scanB.trim()
    if (!a || !b) return

    if (a === b) {
      setStatus('match')
      setMessage(`Match: ${a}`)
      try {
        await onMatch(a)
        reset(true)
      } catch (error: any) {
        setStatus('error')
        setMessage(error?.message || 'Kon lotnummer niet verplaatsen')
        setTimeout(() => reset(true), 2000)
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
    }, 1200)
  }

  useEffect(() => {
    if (scanA.trim() && scanB.trim()) {
      void handleCompare()
    }
  }, [scanA, scanB])

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
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
          onChange={(e) => setScanA(e.target.value)}
          placeholder="Scan 1 (Lot Number)"
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        <input
          ref={inputBRef}
          type="text"
          value={scanB}
          onChange={(e) => setScanB(e.target.value)}
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
