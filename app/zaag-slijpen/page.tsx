'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SawSharpeningLine, SawSharpeningRound } from '@/types/database'
import { SignaturePad, type SignaturePadHandle } from '@/components/saw-sharpening/SignaturePad'

type LineDraft = {
  description: string
  quantity_pickup: number
  quantity_return: string
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function localInputToIso(local: string): string | null {
  if (!local.trim()) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const emptyLine = (): LineDraft => ({
  description: '',
  quantity_pickup: 0,
  quantity_return: '',
})

export default function ZaagSlijpenPage() {
  const [rounds, setRounds] = useState<SawSharpeningRound[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null)

  const [driverName, setDriverName] = useState('')
  const [pickupAt, setPickupAt] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])

  const supplierSigRef = useRef<SignaturePadHandle>(null)
  const forescoSigRef = useRef<SignaturePadHandle>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const fetchRounds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/saw-sharpening/rounds')
      if (!res.ok) throw new Error('fetch')
      const data = await res.json()
      setRounds(data.rounds || [])
    } catch {
      setRounds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRounds()
  }, [fetchRounds])

  const resetFormNew = useCallback(() => {
    const now = isoToLocalInput(new Date().toISOString())
    setDriverName('')
    setPickupAt(now)
    setReturnAt('')
    setNotes('')
    setLines([emptyLine()])
    supplierSigRef.current?.clear()
    forescoSigRef.current?.clear()
  }, [])

  const loadRoundIntoForm = useCallback((r: SawSharpeningRound) => {
    setDriverName(r.driver_name || '')
    setPickupAt(isoToLocalInput(r.pickup_at))
    setReturnAt(r.return_at ? isoToLocalInput(r.return_at) : '')
    setNotes(r.notes || '')
    const ls = r.lines?.length
      ? r.lines.map(l => ({
          description: l.description,
          quantity_pickup: l.quantity_pickup,
          quantity_return: l.quantity_return === null || l.quantity_return === undefined ? '' : String(l.quantity_return),
        }))
      : [emptyLine()]
    setLines(ls)
    supplierSigRef.current?.clear()
    forescoSigRef.current?.clear()
  }, [])

  useEffect(() => {
    if (selectedId === 'new') resetFormNew()
  }, [selectedId, resetFormNew])

  const buildLinesPayload = () => {
    const cleaned = lines
      .map(l => ({
        description: l.description.trim(),
        quantity_pickup: Math.max(0, Number(l.quantity_pickup) || 0),
        quantity_return:
          l.quantity_return === '' || l.quantity_return === undefined
            ? null
            : Math.max(0, Number(l.quantity_return) || 0),
      }))
      .filter(l => l.description.length > 0)
    return cleaned
  }

  const handleSave = async () => {
    const payloadLines = buildLinesPayload()
    if (payloadLines.length === 0) {
      alert('Voeg minstens één regel toe met een omschrijving.')
      return
    }

    const pickupIso = localInputToIso(pickupAt)
    if (!pickupIso) {
      alert('Ophaaldatum/tijd is ongeldig.')
      return
    }
    const returnIso = returnAt.trim() ? localInputToIso(returnAt) : null
    if (returnAt.trim() && !returnIso) {
      alert('Terugbrengdatum/tijd is ongeldig.')
      return
    }

    setSaving(true)
    try {
      if (selectedId === 'new') {
        const res = await fetch('/api/saw-sharpening/rounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup_at: pickupIso,
            return_at: returnIso,
            driver_name: driverName.trim() || null,
            notes: notes.trim() || null,
            lines: payloadLines,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Opslaan mislukt')
        }
        const data = await res.json()
        await fetchRounds()
        if (data.round?.id) {
          setSelectedId(data.round.id)
          loadRoundIntoForm(data.round)
        }
        alert('Ronde aangemaakt.')
      } else if (typeof selectedId === 'number') {
        const res = await fetch(`/api/saw-sharpening/rounds/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup_at: pickupIso,
            return_at: returnIso,
            driver_name: driverName.trim() || null,
            notes: notes.trim() || null,
            lines: payloadLines,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Opslaan mislukt')
        }
        const data = await res.json()
        await fetchRounds()
        if (data.round) loadRoundIntoForm(data.round)
        alert('Opgeslagen.')
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (typeof selectedId !== 'number') return
    if (!confirm(`Ronde #${selectedId} verwijderen?`)) return
    const res = await fetch(`/api/saw-sharpening/rounds/${selectedId}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('Verwijderen mislukt')
      return
    }
    setSelectedId(null)
    await fetchRounds()
  }

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files?.length || typeof selectedId !== 'number') {
      if (selectedId === 'new') alert('Sla de ronde eerst op voordat u foto’s toevoegt.')
      return
    }
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('photos', f))
    const res = await fetch(`/api/saw-sharpening/rounds/${selectedId}/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      alert('Foto-upload mislukt')
      return
    }
    await fetchRounds()
  }

  const handleSaveSignatures = async () => {
    if (typeof selectedId !== 'number') {
      alert('Sla de ronde eerst op.')
      return
    }
    const s = supplierSigRef.current?.toDataURL()
    const f = forescoSigRef.current?.toDataURL()
    if (!s || !f) {
      alert('Laat beide partijen tekenen in het vak hieronder.')
      return
    }
    const res = await fetch(`/api/saw-sharpening/rounds/${selectedId}/signatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_supplier: s, signature_foresco: f }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e.error || 'Handtekeningen opslaan mislukt')
      return
    }
    supplierSigRef.current?.clear()
    forescoSigRef.current?.clear()
    await fetchRounds()
    alert('Handtekeningen opgeslagen.')
  }

  const handlePrint = () => window.print()

  const selectedRound = typeof selectedId === 'number' ? rounds.find(r => r.id === selectedId) : null
  const signed =
    selectedRound?.signature_supplier_url &&
    selectedRound?.signature_foresco_url

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <header className="mb-8 no-print">
          <h1 className="text-3xl font-bold text-gray-900">Zaag slijpen — leverancier</h1>
          <p className="mt-2 text-gray-600 max-w-3xl">
            Registreer welke zagen zijn meegenomen en teruggebracht. Voeg foto’s toe, sla het akkoorddocument op
            (print / PDF), en laat beide partijen digitaal tekenen.
          </p>
        </header>

        <div className="no-print flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setSelectedId('new')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            + Nieuwe ronde
          </button>
          <button
            type="button"
            onClick={() => fetchRounds()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Vernieuwen
          </button>
        </div>

        {/* Overzicht */}
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-8 no-print">
          <h2 className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-800">Recente rondes</h2>
          {loading ? (
            <p className="p-6 text-gray-500">Laden…</p>
          ) : rounds.length === 0 ? (
            <p className="p-6 text-gray-500">Nog geen rondes. Start met &quot;Nieuwe ronde&quot;.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Ophalen</th>
                    <th className="px-3 py-2">Terug</th>
                    <th className="px-3 py-2">Chauffeur / leverancier</th>
                    <th className="px-3 py-2">Getekend</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map(r => (
                    <tr
                      key={r.id}
                      className={`border-b cursor-pointer hover:bg-indigo-50/50 ${
                        selectedId === r.id ? 'bg-indigo-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedId(r.id)
                        loadRoundIntoForm(r)
                      }}
                    >
                      <td className="px-3 py-2 font-mono">{r.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.pickup_at).toLocaleString('nl-BE')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.return_at ? new Date(r.return_at).toLocaleString('nl-BE') : '—'}
                      </td>
                      <td className="px-3 py-2">{r.driver_name || '—'}</td>
                      <td className="px-3 py-2">
                        {r.signature_supplier_url && r.signature_foresco_url ? (
                          <span className="text-green-700 font-medium">Ja</span>
                        ) : (
                          <span className="text-amber-600">Nee</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(selectedId === 'new' || typeof selectedId === 'number') && (
          <>
            <div className="grid lg:grid-cols-2 gap-8 no-print">
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5 space-y-4">
                <h2 className="font-semibold text-lg text-gray-900">
                  {selectedId === 'new' ? 'Nieuwe ronde' : `Ronde #${selectedId} bewerken`}
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chauffeur / contact leverancier</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="Naam"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ophalen (datum & tijd)</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded-lg px-3 py-2"
                      value={pickupAt}
                      onChange={e => setPickupAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teruggebracht (optioneel)</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded-lg px-3 py-2"
                      value={returnAt}
                      onChange={e => setReturnAt(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opmerkingen</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 min-h-[72px]"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Extra info…"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Zagen / regels</span>
                    <button
                      type="button"
                      className="text-sm text-indigo-600 font-medium"
                      onClick={() => setLines(prev => [...prev, emptyLine()])}
                    >
                      + Regel
                    </button>
                  </div>
                  <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                    {lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-5">
                          {i === 0 && (
                            <span className="block text-xs text-gray-500 mb-0.5">Omschrijving / type</span>
                          )}
                          <input
                            className="w-full border rounded px-2 py-1.5 text-sm"
                            value={line.description}
                            onChange={e => {
                              const next = [...lines]
                              next[i] = { ...line, description: e.target.value }
                              setLines(next)
                            }}
                            placeholder="Bv. cirkelzaag 450mm"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          {i === 0 && (
                            <span className="block text-xs text-gray-500 mb-0.5">Meegenomen</span>
                          )}
                          <input
                            type="number"
                            min={0}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                            value={line.quantity_pickup}
                            onChange={e => {
                              const next = [...lines]
                              next[i] = { ...line, quantity_pickup: Number(e.target.value) || 0 }
                              setLines(next)
                            }}
                          />
                        </div>
                        <div className="col-span-5 sm:col-span-3">
                          {i === 0 && (
                            <span className="block text-xs text-gray-500 mb-0.5">Terug (leeg = nog niet)</span>
                          )}
                          <input
                            type="number"
                            min={0}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                            value={line.quantity_return}
                            onChange={e => {
                              const next = [...lines]
                              next[i] = { ...line, quantity_return: e.target.value }
                              setLines(next)
                            }}
                            placeholder="—"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              className="text-red-600 text-sm px-1"
                              aria-label="Regel verwijderen"
                              onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {saving ? 'Bezig…' : 'Opslaan'}
                  </button>
                  {typeof selectedId === 'number' && (
                    <>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Foto’s uploaden
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => handlePhotoUpload(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        Verwijderen
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Handtekeningen */}
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5 space-y-4">
                <h2 className="font-semibold text-lg text-gray-900">Akkoord — handtekeningen</h2>
                <p className="text-sm text-gray-600">
                  Ondergetekenden verklaren akkoord te zijn met de aantallen <strong>meegenomen</strong> en{' '}
                  <strong>teruggebracht</strong> zoals vermeld op dit document.
                </p>
                {signed && (
                  <p className="text-sm text-green-700 font-medium">
                    Er zijn al handtekeningen opgeslagen voor deze ronde. Teken opnieuw om te vervangen.
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <SignaturePad ref={supplierSigRef} label="Handtekening leverancier / chauffeur" />
                  <SignaturePad ref={forescoSigRef} label="Handtekening Foresco" />
                </div>
                <button
                  type="button"
                  onClick={handleSaveSignatures}
                  disabled={typeof selectedId !== 'number'}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  Handtekeningen opslaan
                </button>
              </div>
            </div>

            {/* Afdrukdocument */}
            <div
              id="zaag-slijpen-doc"
              className="mt-10 bg-white rounded-xl shadow border border-gray-200 p-6 print:shadow-none print:border-0"
            >
              <div className="flex justify-between items-start gap-4 mb-6 no-print">
                <h2 className="font-semibold text-xl text-gray-900">Akkoorddocument</h2>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
                >
                  Afdrukken / PDF
                </button>
              </div>
              <div className="hidden print:block text-center font-bold text-lg mb-4">Akkoord zaag slijpen — Foresco</div>

              <dl className="grid sm:grid-cols-2 gap-2 text-sm mb-6">
                <div>
                  <dt className="text-gray-500">Chauffeur / leverancier</dt>
                  <dd className="font-medium">{driverName || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Document ronde</dt>
                  <dd className="font-medium">{selectedId === 'new' ? '(nieuw)' : `#${selectedId}`}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Ophalen</dt>
                  <dd className="font-medium">
                    {(() => {
                      const iso = localInputToIso(pickupAt)
                      return iso ? new Date(iso).toLocaleString('nl-BE') : '—'
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Teruggebracht</dt>
                  <dd className="font-medium">
                    {(() => {
                      const iso = returnAt.trim() ? localInputToIso(returnAt) : null
                      return iso ? new Date(iso).toLocaleString('nl-BE') : '—'
                    })()}
                  </dd>
                </div>
              </dl>

              {notes.trim() && (
                <p className="text-sm mb-4 border rounded-lg p-3 bg-gray-50">
                  <strong>Opmerking:</strong> {notes}
                </p>
              )}

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left px-3 py-2 border-r">Omschrijving</th>
                      <th className="text-right px-3 py-2 border-r w-24">Meegenomen</th>
                      <th className="text-right px-3 py-2 w-24">Terug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildLinesPayload().map((l, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 border-r">{l.description}</td>
                        <td className="px-3 py-2 text-right border-r">{l.quantity_pickup}</td>
                        <td className="px-3 py-2 text-right">
                          {l.quantity_return === null ? '—' : l.quantity_return}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                Wij ondergetekenden bevestigen dat de hierboven vermelde aantallen correct zijn: het aantal zagen
                dat door de leverancier is meegenomen ter sluiting/slijpen, en het aantal dat opnieuw werd
                afgeleverd. Bij afwijking wordt dit vermeld in de opmerkingen vóór ondertekening.
              </p>

              {(selectedRound?.photo_urls?.length ?? 0) > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Foto&apos;s bijlage</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRound!.photo_urls!.map((url, i) => (
                      <a key={url + i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-20 w-20 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(selectedRound?.signature_supplier_url || selectedRound?.signature_foresco_url) && (
                <div className="grid sm:grid-cols-2 gap-6 border-t pt-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Handtekening leverancier (bewaard)</p>
                    {selectedRound?.signature_supplier_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={selectedRound.signature_supplier_url} alt="" className="max-h-28 border rounded bg-white" />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Handtekening Foresco (bewaard)</p>
                    {selectedRound?.signature_foresco_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={selectedRound.signature_foresco_url} alt="" className="max-h-28 border rounded bg-white" />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
