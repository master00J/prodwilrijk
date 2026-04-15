'use client'

import { useState, useRef, useCallback } from 'react'

interface ScanMatch {
  id: number
  item_number: string | null
  po_number: string | null
  amount: number
  date_added: string
}

interface ScanResult {
  label: {
    item_number: string | null
    quantity: number | null
    description: string | null
    po_line: string | null
    supplier: string | null
    date: string | null
  }
  matches: ScanMatch[]
  warning: string | null
}

interface LabelScannerProps {
  onItemsMatched: (ids: number[]) => void
  onUnlistedAdded: () => void
}

function normalizeItemNumber(raw: string): string {
  return raw.replace(/[\s\-\.]/g, '').toUpperCase()
}

export default function LabelScanner({ onItemsMatched, onUnlistedAdded }: LabelScannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [adding, setAdding] = useState(false)
  const [isExtraPallet, setIsExtraPallet] = useState(false)
  const [scanTally, setScanTally] = useState<Record<string, { scanned: number; inList: number }>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)
    setIsExtraPallet(false)

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      setScanning(true)

      try {
        const base64 = dataUrl.split(',')[1]
        const mediaType = file.type || 'image/jpeg'

        const res = await fetch('/api/incoming-goods/scan-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Scan mislukt (${res.status})`)
        }

        const data: ScanResult = await res.json()
        setResult(data)

        if (data.matches.length > 0 && data.label.item_number) {
          const key = normalizeItemNumber(data.label.item_number)
          const listTotal = data.matches.reduce((sum, m) => sum + m.amount, 0)
          const labelQty = data.label.quantity || 1

          setScanTally(prev => {
            const existing = prev[key] || { scanned: 0, inList: listTotal }
            const newScanned = existing.scanned + labelQty
            const updated = { ...prev, [key]: { scanned: newScanned, inList: listTotal } }

            if (newScanned > listTotal) {
              setIsExtraPallet(true)
            } else {
              setIsExtraPallet(false)
              onItemsMatched(data.matches.map(m => m.id))
            }

            return updated
          })

          setScanCount(prev => prev + 1)
        }
      } catch (err: any) {
        setError(err.message || 'Onbekende fout bij scannen')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onItemsMatched])

  const handleNewScan = () => {
    setResult(null)
    setPreview(null)
    setError(null)
    setIsExtraPallet(false)
    fileInputRef.current?.click()
  }

  const handleAddToUnlisted = useCallback(async (extraOpmerking?: string) => {
    if (!result?.label) return
    setAdding(true)
    try {
      const label = result.label
      const key = label.item_number ? normalizeItemNumber(label.item_number) : null
      const tally = key ? scanTally[key] : null
      const opmerking = extraOpmerking
        || (tally
          ? `Extra pallet — ${tally.scanned} gescand, ${tally.inList} in WMS-lijst`
          : 'Toegevoegd via label scan — niet in WMS-import')

      const res = await fetch('/api/incoming-goods/unlisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_number: label.item_number,
          quantity: label.quantity || 1,
          description: label.description,
          po_line: label.po_line,
          supplier: label.supplier,
          label_date: label.date,
          opmerking,
        }),
      })
      if (!res.ok) throw new Error('Toevoegen mislukt')
      onUnlistedAdded()
      setScanCount(prev => prev + 1)
      setResult(null)
      setPreview(null)
      setIsExtraPallet(false)
    } catch (err: any) {
      setError(err.message || 'Kon item niet toevoegen')
    } finally {
      setAdding(false)
    }
  }, [result, onUnlistedAdded, scanTally])

  const handleClose = () => {
    setIsOpen(false)
    setResult(null)
    setPreview(null)
    setError(null)
    setScanCount(0)
    setIsExtraPallet(false)
    setScanTally({})
  }

  const currentTally = result?.label.item_number
    ? scanTally[normalizeItemNumber(result.label.item_number)]
    : null

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => fileInputRef.current?.click(), 100) }}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Scan Label
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-800">Label Scanner</h3>
          {scanCount > 0 && (
            <span className="bg-green-100 text-green-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {scanCount} gescand
            </span>
          )}
        </div>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {scanning && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Label analyseren met AI...</p>
          {preview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="Scan preview" className="mt-2 max-h-32 rounded-lg opacity-50" />
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-red-700 font-medium">Scan mislukt</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button onClick={handleNewScan} className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium underline">
            Opnieuw proberen
          </button>
        </div>
      )}

      {result && !scanning && (
        <div className="space-y-4">
          {/* Herkende label data */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Herkend van label</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-xs text-gray-500">Part Nr</span>
                <p className="font-bold text-gray-900 text-lg">{result.label.item_number || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Aantal</span>
                <p className="font-bold text-gray-900 text-lg">{result.label.quantity ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">P.O. Lijn</span>
                <p className="font-medium text-gray-700">{result.label.po_line || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Omschrijving</span>
                <p className="font-medium text-gray-700 truncate">{result.label.description || '—'}</p>
              </div>
            </div>
            {(result.label.supplier || result.label.date) && (
              <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-200">
                {result.label.supplier && (
                  <div>
                    <span className="text-xs text-gray-500">Leverancier</span>
                    <p className="text-sm text-gray-600">{result.label.supplier}</p>
                  </div>
                )}
                {result.label.date && (
                  <div>
                    <span className="text-xs text-gray-500">Datum</span>
                    <p className="text-sm text-gray-600">{result.label.date}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scan tally indicator */}
          {currentTally && result.matches.length > 0 && (
            <div className={`rounded-lg px-4 py-3 flex items-center gap-3 ${
              isExtraPallet
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className={`text-2xl font-bold ${isExtraPallet ? 'text-red-600' : 'text-blue-600'}`}>
                {currentTally.scanned}/{currentTally.inList}
              </div>
              <div>
                <p className={`font-medium text-sm ${isExtraPallet ? 'text-red-800' : 'text-blue-800'}`}>
                  {isExtraPallet
                    ? 'Extra pallet! Meer gescand dan in de WMS-lijst staat.'
                    : `${currentTally.scanned} van ${currentTally.inList} gescand voor dit item`
                  }
                </p>
                {isExtraPallet && (
                  <p className="text-red-600 text-xs mt-0.5">
                    Deze pallet is niet gescand bij de vorige locatie. Voeg toe aan &quot;Niet in lijst&quot;.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Warning */}
          {result.warning && !isExtraPallet && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-amber-700 text-sm font-medium">{result.warning}</p>
            </div>
          )}

          {/* Extra pallet → add to unlisted */}
          {isExtraPallet && result.matches.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Item staat in de lijst, maar dit is een extra pallet
              </h4>
              <div className="border border-green-200 rounded-lg overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-green-800">Item Nr</th>
                      <th className="text-left px-3 py-2 font-semibold text-green-800">Pallet Nr</th>
                      <th className="text-right px-3 py-2 font-semibold text-green-800">In lijst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map(m => (
                      <tr key={m.id} className="border-t border-green-100">
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{m.item_number}</td>
                        <td className="px-3 py-2 text-gray-700">{m.po_number || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">{m.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => handleAddToUnlisted()}
                disabled={adding}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-300 transition-colors font-medium text-sm"
              >
                {adding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Toevoegen...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Extra pallet toevoegen aan &quot;Niet in lijst&quot;
                  </>
                )}
              </button>
            </div>

          ) : result.matches.length > 0 && !isExtraPallet ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {result.matches.length} lijn(en) gevonden en geselecteerd
              </h4>
              <div className="border border-green-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-green-800">Item Nr</th>
                      <th className="text-left px-3 py-2 font-semibold text-green-800">Pallet Nr</th>
                      <th className="text-right px-3 py-2 font-semibold text-green-800">Aantal</th>
                      <th className="text-left px-3 py-2 font-semibold text-green-800">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map(m => (
                      <tr key={m.id} className="border-t border-green-100">
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{m.item_number}</td>
                        <td className="px-3 py-2 text-gray-700">{m.po_number || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">{m.amount}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {m.date_added ? new Date(m.date_added).toLocaleDateString('nl-BE') : '—'}
                        </td>
                      </tr>
                    ))}
                    {result.matches.length > 1 && (
                      <tr className="border-t-2 border-green-300 bg-green-50">
                        <td className="px-3 py-2 font-semibold text-green-800" colSpan={2}>Totaal</td>
                        <td className="px-3 py-2 text-right font-bold text-green-800">
                          {result.matches.reduce((sum, m) => sum + m.amount, 0)}
                        </td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          ) : result.label.item_number ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-orange-800 font-medium">Niet gevonden in de WMS-import</p>
                  <p className="text-orange-600 text-sm mt-1">
                    Item {result.label.item_number} staat niet in de geüploade lijst.
                    Dit kan van een andere flow zijn (bijv. Airtec of Grote Inpak).
                  </p>
                  <button
                    onClick={() => handleAddToUnlisted('Toegevoegd via label scan — niet in WMS-import')}
                    disabled={adding}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-300 transition-colors font-medium text-sm"
                  >
                    {adding ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Toevoegen...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Toevoegen aan &quot;Niet in lijst&quot;
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Geen item nummer herkend op het label.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleNewScan}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Volgende label scannen
            </button>
          </div>
        </div>
      )}

      {!scanning && !result && !error && (
        <div className="flex flex-col items-center py-6 gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-indigo-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer w-full"
          >
            <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-indigo-600 font-medium text-lg">Maak een foto van het label</span>
            <span className="text-gray-500 text-sm">De camera opent automatisch</span>
          </button>
        </div>
      )}
    </div>
  )
}
