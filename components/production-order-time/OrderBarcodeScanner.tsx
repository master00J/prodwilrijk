'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, ScanBarcode, X } from 'lucide-react'

type OrderBarcodeScannerProps = {
  open: boolean
  onClose: () => void
  onScan: (orderNumber: string) => void
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

export function normalizeScannedOrderNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export function OrderBarcodeScanner({ open, onClose, onScan }: OrderBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const usbInputRef = useRef<HTMLInputElement>(null)
  const lastCodeRef = useRef('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleCode = useCallback(
    (raw: string) => {
      const code = normalizeScannedOrderNumber(raw)
      if (!code || code === lastCodeRef.current) return
      lastCodeRef.current = code
      setStatusMessage(`Ordernummer: ${code}`)
      onScan(code)
      onClose()
    },
    [onScan, onClose]
  )

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraStarting(true)

    try {
      const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
        .BarcodeDetector
      if (!BarcodeDetectorCtor) {
        setCameraError(
          'Camera-scannen wordt niet ondersteund in deze browser. Gebruik een USB-scanner of typ het ordernummer hieronder.'
        )
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      const detector = new BarcodeDetectorCtor({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'],
      })

      const scanFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => void scanFrame())
          return
        }
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleCode(barcodes[0].rawValue)
            return
          }
        } catch {
          // Frame read errors are ignored; scanning continues.
        }
        rafRef.current = requestAnimationFrame(() => void scanFrame())
      }

      rafRef.current = requestAnimationFrame(() => void scanFrame())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera kon niet gestart worden'
      setCameraError(message)
    } finally {
      setCameraStarting(false)
    }
  }, [handleCode])

  useEffect(() => {
    if (!open) {
      stopCamera()
      lastCodeRef.current = ''
      setManualCode('')
      setCameraError(null)
      setStatusMessage(null)
      return
    }

    const focusTimer = window.setTimeout(() => usbInputRef.current?.focus(), 100)
    void startCamera()

    return () => {
      window.clearTimeout(focusTimer)
      stopCamera()
    }
  }, [open, startCamera, stopCamera])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Scan werkbon</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Sluit scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Scan de barcode op de werkbon. Het ordernummer opent automatisch de juiste productieorder.
          </p>

          <div className="relative rounded-lg overflow-hidden bg-gray-900 min-h-[220px]">
            <video ref={videoRef} className="w-full h-[220px] object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-6 border-2 border-white/70 rounded-lg" />
            {cameraStarting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-white text-sm">
                <Camera className="h-5 w-5 mr-2 animate-pulse" />
                Camera starten...
              </div>
            ) : null}
            {cameraError ? (
              <div className="absolute inset-x-0 bottom-0 bg-gray-900/90 text-white text-xs px-4 py-3 text-center">
                {cameraError}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
              <Keyboard className="h-3.5 w-3.5" />
              USB-scanner of handmatig
            </div>
            <input
              ref={usbInputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCode(manualCode)
                }
              }}
              placeholder="Scan hier of typ ordernummer + Enter"
              className="w-full px-3 py-3 min-h-[48px] border border-gray-300 rounded-lg text-base"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => handleCode(manualCode)}
              disabled={!manualCode.trim()}
              className="mt-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              Order openen
            </button>
          </div>

          {statusMessage ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{statusMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
