'use client'

import { useState, useEffect, useRef } from 'react'
import { AirtecUnlistedItem } from '@/types/database'
import Link from 'next/link'

const DEFAULT_EMAIL = 'prodwilrijk@foresco.eu'

export default function UnlistedItemsSection() {
  const [items, setItems] = useState<AirtecUnlistedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    beschrijving: '',
    item_number: '',
    lot_number: '',
    datum_opgestuurd: '',
    kistnummer: '',
    divisie: '',
    quantity: '1',
    opmerking: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [sendLoading, setSendLoading] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const isCoolerDescription = form.beschrijving.toLowerCase().includes('cooler')

  useEffect(() => {
    if (!isCoolerDescription) return
    setForm((prev) => ({ ...prev, lot_number: '', divisie: '' }))
  }, [isCoolerDescription])

  useEffect(() => {
    const itemNumber = form.item_number.trim()
    if (!itemNumber || form.kistnummer) return
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/incoming-goods-airtec/lookup?item_number=${encodeURIComponent(itemNumber)}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (data?.kistnummer) {
          setForm((prev) => ({ ...prev, kistnummer: data.kistnummer }))
        }
      } catch {
        // ignore
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [form.item_number, form.kistnummer])

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/incoming-goods-airtec/unlisted')
      if (!res.ok) throw new Error('Ophalen mislukt')
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.beschrijving.trim()) {
      alert('Beschrijving is verplicht')
      return
    }
    setAddLoading(true)
    try {
      const res = await fetch('/api/incoming-goods-airtec/unlisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschrijving: form.beschrijving.trim(),
          item_number: form.item_number.trim() || null,
          lot_number: form.lot_number.trim() || null,
          datum_opgestuurd: form.datum_opgestuurd || null,
          kistnummer: form.kistnummer.trim() || null,
          divisie: form.divisie.trim() || null,
          quantity: parseInt(form.quantity, 10) || 1,
          opmerking: form.opmerking.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Toevoegen mislukt')
      }
      setForm({
        beschrijving: '',
        item_number: '',
        lot_number: '',
        datum_opgestuurd: '',
        kistnummer: '',
        divisie: '',
        quantity: '1',
        opmerking: '',
      })
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toevoegen mislukt')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Dit item verwijderen?')) return
    try {
      const res = await fetch(`/api/incoming-goods-airtec/unlisted/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }

  const handlePhotoUpload = async (id: number, files: FileList | null) => {
    if (!files?.length) return
    setUploadingId(id)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i])
      }
      const res = await fetch(`/api/incoming-goods-airtec/unlisted/${id}/photos`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload mislukt')
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setUploadingId(null)
    }
  }

  const handleSendEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      alert('Vul een geldig e-mailadres in')
      return
    }
    const pending = items.filter((i) => i.status === 'pending')
    if (pending.length === 0) {
      alert('Er staan geen items klaar om te versturen (status: pending).')
      return
    }
    if (!confirm(`Overzicht mailen naar ${email} met ${pending.length} item(s)?`)) return
    setSendLoading(true)
    try {
      const res = await fetch('/api/incoming-goods-airtec/unlisted/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          itemIds: pending.map((i) => i.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Verzenden mislukt')
      alert(`E-mail verzonden naar ${email}. De items zijn gemarkeerd als "e-mail verzonden".`)
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verzenden mislukt')
    } finally {
      setSendLoading(false)
    }
  }

  const handleMoveToPack = async () => {
    const toMove = items.filter((i) => i.status === 'email_sent')
    if (toMove.length === 0) {
      alert('Geen items met status "E-mail verzonden" om naar Items to Pack te verplaatsen.')
      return
    }
    if (!confirm(`${toMove.length} item(s) naar Items to Pack Airtec verplaatsen? (klant heeft goedgekeurd)`)) return
    setMoveLoading(true)
    try {
      const res = await fetch('/api/incoming-goods-airtec/unlisted/move-to-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toMove.map((i) => i.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Verplaatsen mislukt')
      alert(`${data.count ?? toMove.length} item(s) toegevoegd aan Items to Pack Airtec.`)
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verplaatsen mislukt')
    } finally {
      setMoveLoading(false)
    }
  }

  const pendingItems = items.filter((i) => i.status === 'pending')
  const emailSentItems = items.filter((i) => i.status === 'email_sent')

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('nl-BE') : '–'

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6 border border-amber-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-xl font-semibold text-amber-800">
          Items niet in lijst – vraag naar klant
        </h2>
        <span className="text-2xl text-amber-600">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Voeg hier items toe die jullie hebben ontvangen maar die niet in de standaardlijst staan.
            Velden zijn gelijk aan &quot;Add New Incoming Good&quot;. Voeg per item eventueel foto&apos;s toe,
            stuur een overzicht naar de klant en verplaats ze daarna naar Items to Pack zodra de klant
            bevestigt dat ze verpakt mogen worden.
          </p>

          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-2 font-medium">Description</label>
              <input
                type="text"
                value={form.beschrijving}
                onChange={(e) => setForm((f) => ({ ...f, beschrijving: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Item Number</label>
              <input
                type="text"
                value={form.item_number}
                onChange={(e) => setForm((f) => ({ ...f, item_number: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Lot Number</label>
              <input
                type="text"
                value={form.lot_number}
                onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={isCoolerDescription}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Date Sent</label>
              <input
                type="date"
                value={form.datum_opgestuurd}
                onChange={(e) => setForm((f) => ({ ...f, datum_opgestuurd: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Box Number (Kistnummer)</label>
              <input
                type="text"
                value={form.kistnummer}
                onChange={(e) => setForm((f) => ({ ...f, kistnummer: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Division</label>
              <input
                type="text"
                value={form.divisie}
                onChange={(e) => setForm((f) => ({ ...f, divisie: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={isCoolerDescription}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Opmerking (optioneel)</label>
              <input
                type="text"
                value={form.opmerking}
                onChange={(e) => setForm((f) => ({ ...f, opmerking: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Extra info voor de klant"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={addLoading}
                className="w-full px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-300 font-medium"
              >
                {addLoading ? 'Bezig…' : 'Item toevoegen'}
              </button>
            </div>
          </form>

          {loading ? (
            <p className="text-gray-500">Laden…</p>
          ) : (
            <>
              {items.length === 0 ? (
                <p className="text-gray-500">Nog geen items toegevoegd.</p>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800">Overzicht items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-sm font-medium">Beschrijving</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Itemnr</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Lot</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Datum opgestuurd</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Kistnr</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Divisie</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Aantal</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Opmerking</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Foto&apos;s</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Status</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-24">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-t border-gray-200">
                            <td className="px-3 py-2 text-sm">{item.beschrijving}</td>
                            <td className="px-3 py-2 text-sm">{item.item_number || '–'}</td>
                            <td className="px-3 py-2 text-sm">{item.lot_number || '–'}</td>
                            <td className="px-3 py-2 text-sm">{formatDate(item.datum_opgestuurd)}</td>
                            <td className="px-3 py-2 text-sm">{item.kistnummer || '–'}</td>
                            <td className="px-3 py-2 text-sm">{item.divisie || '–'}</td>
                            <td className="px-3 py-2 text-sm">{item.quantity}</td>
                            <td className="px-3 py-2 text-sm max-w-[140px] truncate" title={item.opmerking || ''}>
                              {item.opmerking || '–'}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1 items-center">
                                {(item.photo_urls || []).map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block w-12 h-12 rounded border border-gray-200 overflow-hidden bg-gray-100"
                                  >
                                    <img
                                      src={url}
                                      alt="Foto"
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ))}
                                {item.status === 'pending' && (
                                  <>
                                    <input
                                      ref={(el) => {
                                        fileInputRefs.current[item.id] = el
                                      }}
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => {
                                        handlePhotoUpload(item.id, e.target.files)
                                        e.target.value = ''
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={uploadingId === item.id}
                                      onClick={() => fileInputRefs.current[item.id]?.click()}
                                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 disabled:opacity-50"
                                    >
                                      {uploadingId === item.id ? 'Bezig…' : '+ Foto'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span
                                className={
                                  item.status === 'pending'
                                    ? 'text-amber-600'
                                    : item.status === 'email_sent'
                                    ? 'text-blue-600'
                                    : item.status === 'approved'
                                    ? 'text-green-600'
                                    : 'text-gray-500'
                                }
                              >
                                {item.status === 'pending'
                                  ? 'Pending'
                                  : item.status === 'email_sent'
                                  ? 'E-mail verzonden'
                                  : item.status === 'approved'
                                  ? 'Goedgekeurd'
                                  : item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {item.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Verwijderen
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pendingItems.length > 0 && (
                <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
                  <div className="flex-1 w-full sm:max-w-xs">
                    <label className="block mb-1 font-medium text-sm">E-mailadres klant</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={DEFAULT_EMAIL}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={sendLoading || !email.trim()}
                    className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    {sendLoading ? 'Bezig…' : `Mail overzicht naar klant (${pendingItems.length} item(s))`}
                  </button>
                </div>
              )}

              {emailSentItems.length > 0 && (
                <div className="pt-4 border-t border-gray-200 flex flex-wrap gap-4 items-center">
                  <button
                    type="button"
                    onClick={handleMoveToPack}
                    disabled={moveLoading}
                    className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-medium"
                  >
                    {moveLoading ? 'Bezig…' : `Klant heeft goedgekeurd → Naar Items to Pack (${emailSentItems.length} item(s))`}
                  </button>
                  <Link
                    href="/items-to-pack-airtec"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ga naar Items to Pack Airtec →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
