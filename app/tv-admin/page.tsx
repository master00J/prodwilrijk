'use client'

import { useState, useEffect, useCallback } from 'react'

type SlideType = 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders' | 'inpakstatistiek' | 'dagplanning' | 'countdown' | 'weer'

interface TvSlide {
  id: string
  type: SlideType
  title: string | null
  content: any
  sort_order: number
  active: boolean
  duration: number | null
  created_at: string
  updated_at: string
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  werkorders: 'Werkorders',
  tekst: 'Tekst / Bericht',
  afbeelding: 'Afbeelding',
  productieorders: 'Productieorders (live)',
  inpakstatistiek: 'Prepack + Airtec (statistiek)',
  dagplanning: 'Dagplanning (live)',
  countdown: 'Countdown / Deadline',
  weer: 'Weer (live)',
}

export default function TvAdminPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<TvSlide | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newType, setNewType] = useState<SlideType>('werkorders')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSlides = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides')
      const json = await res.json()
      setSlides(json.data || [])
    } catch (e) {
      console.error('Fout bij laden slides:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  const createSlide = async () => {
    setSaving(true)
    try {
      const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 0
      const defaultContent = newType === 'werkorders'
        ? { lines: [''] }
        : newType === 'tekst'
        ? { text: '' }
        : newType === 'countdown'
        ? { targetDate: '', description: '' }
        : newType === 'dagplanning'
        ? { manualEntries: [] }
        : newType === 'weer'
        ? { latitude: 51.16, longitude: 4.39 }
        : newType === 'productieorders' || newType === 'inpakstatistiek'
        ? {}
        : { url: '' }

      const res = await fetch('/api/tv-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, title: '', content: defaultContent, sort_order: maxOrder }),
      })
      const json = await res.json()
      if (json.data) {
        setSlides(prev => [...prev, json.data])
        setEditingSlide(json.data)
        setShowAddForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const updateSlide = async (slide: TvSlide) => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/tv-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slide),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveMsg({ type: 'error', text: json.error || 'Opslaan mislukt' })
        return
      }
      setSlides(prev => prev.map(s => s.id === slide.id ? slide : s))
      setSaveMsg({ type: 'success', text: 'Opgeslagen!' })
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Opslaan mislukt' })
    } finally {
      setSaving(false)
    }
  }

  const deleteSlide = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze slide wilt verwijderen?')) return
    await fetch('/api/tv-slides', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSlides(prev => prev.filter(s => s.id !== id))
    if (editingSlide?.id === id) setEditingSlide(null)
  }

  const toggleActive = async (slide: TvSlide) => {
    const updated = { ...slide, active: !slide.active }
    await updateSlide(updated)
  }

  const moveSlide = async (slide: TvSlide, direction: 'up' | 'down') => {
    const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(s => s.id === slide.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const other = sorted[swapIdx]
    const tmpOrder = slide.sort_order
    slide.sort_order = other.sort_order
    other.sort_order = tmpOrder

    await Promise.all([updateSlide(slide), updateSlide(other)])
  }

  const handleImageUpload = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch('/api/tv-slides/upload-image', { method: 'POST', body: formData })
      const json = await res.json()
      return json.url || null
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-xl">Laden...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">TV Dashboard Beheer</h1>
        <div className="flex gap-3">
          <a
            href="/tv-display"
            target="_blank"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            Open TV Display &rarr;
          </a>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Nieuwe Slide
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-semibold mb-3">Nieuwe slide toevoegen</h2>
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as any)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="werkorders">Werkorders</option>
                <option value="tekst">Tekst / Bericht</option>
                <option value="afbeelding">Afbeelding</option>
                <option value="productieorders">Productieorders (live)</option>
                <option value="inpakstatistiek">Prepack + Airtec (statistiek)</option>
                <option value="dagplanning">Dagplanning (live)</option>
                <option value="countdown">Countdown / Deadline</option>
                <option value="weer">Weer (live)</option>
              </select>
            </div>
            <button
              onClick={createSlide}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              Aanmaken
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {saveMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          saveMsg.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {saveMsg.text}
        </div>
      )}

      {slides.length === 0 && !showAddForm && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Geen slides. Klik op &quot;+ Nieuwe Slide&quot; om te beginnen.
        </div>
      )}

      <div className="space-y-3">
        {[...slides].sort((a, b) => a.sort_order - b.sort_order).map(slide => (
          <div
            key={slide.id}
            className={`bg-white rounded-lg shadow border-l-4 ${
              slide.active ? 'border-green-500' : 'border-gray-300'
            } ${editingSlide?.id === slide.id ? 'ring-2 ring-blue-300' : ''}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col gap-1">
                <button onClick={() => moveSlide(slide, 'up')} className="text-gray-400 hover:text-gray-700 text-xs leading-none">▲</button>
                <button onClick={() => moveSlide(slide, 'down')} className="text-gray-400 hover:text-gray-700 text-xs leading-none">▼</button>
              </div>

              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                slide.type === 'werkorders' ? 'bg-blue-100 text-blue-700' :
                slide.type === 'tekst' ? 'bg-purple-100 text-purple-700' :
                slide.type === 'productieorders' ? 'bg-green-100 text-green-700' :
                slide.type === 'inpakstatistiek' ? 'bg-teal-100 text-teal-800' :
                slide.type === 'dagplanning' ? 'bg-orange-100 text-orange-800' :
                slide.type === 'countdown' ? 'bg-rose-100 text-rose-700' :
                slide.type === 'weer' ? 'bg-sky-100 text-sky-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {SLIDE_TYPE_LABELS[slide.type]}
              </span>

              <span className="font-medium text-gray-900 flex-1 truncate">
                {slide.title || <span className="text-gray-400 italic">Geen titel</span>}
              </span>

              <button
                onClick={() => toggleActive(slide)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  slide.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {slide.active ? 'Actief' : 'Uit'}
              </button>

              <button
                onClick={() => setEditingSlide(editingSlide?.id === slide.id ? null : slide)}
                className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100"
              >
                {editingSlide?.id === slide.id ? 'Sluiten' : 'Bewerken'}
              </button>

              <button
                onClick={() => deleteSlide(slide.id)}
                className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100"
              >
                Verwijderen
              </button>
            </div>

            {editingSlide?.id === slide.id && (
              <SlideEditor
                slide={editingSlide}
                onChange={setEditingSlide}
                onSave={async (s) => { await updateSlide(s); setEditingSlide(s) }}
                onUploadImage={handleImageUpload}
                saving={saving}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SlideEditor({
  slide, onChange, onSave, onUploadImage, saving,
}: {
  slide: TvSlide
  onChange: (s: TvSlide) => void
  onSave: (s: TvSlide) => Promise<void>
  onUploadImage: (file: File) => Promise<string | null>
  saving: boolean
}) {
  const [uploading, setUploading] = useState(false)

  const update = (patch: Partial<TvSlide>) => onChange({ ...slide, ...patch })
  const updateContent = (patch: any) => onChange({ ...slide, content: { ...slide.content, ...patch } })

  return (
    <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
          <input
            type="text"
            value={slide.title || ''}
            onChange={e => update({ title: e.target.value })}
            placeholder="Optionele titel (wordt bovenaan de slide getoond)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Duur (sec)</label>
          <input
            type="number"
            min={5}
            max={300}
            value={slide.duration ?? ''}
            onChange={e => update({ duration: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder="15"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">Leeg = 15s</span>
        </div>
      </div>

      {slide.type === 'werkorders' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Werkorders (1 per regel)
          </label>
          <textarea
            value={(slide.content?.lines || []).join('\n')}
            onChange={e => updateContent({ lines: e.target.value.split('\n') })}
            rows={10}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="PVO26-01234 — Compressor ABC&#10;PVO26-05678 — Motor XYZ"
          />
        </div>
      )}

      {slide.type === 'tekst' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tekst</label>
          <textarea
            value={slide.content?.text || ''}
            onChange={e => updateContent({ text: e.target.value })}
            rows={6}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Typ hier het bericht dat op de TV getoond moet worden..."
          />
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Lettergrootte</label>
            <select
              value={slide.content?.fontSize || 'large'}
              onChange={e => updateContent({ fontSize: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="medium">Normaal</option>
              <option value="large">Groot</option>
              <option value="xlarge">Extra Groot</option>
            </select>
          </div>
        </div>
      )}

      {slide.type === 'productieorders' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          <p className="font-medium mb-1">Automatische slide</p>
          <p>
            Deze slide toont live de actieve productieorders en hun status. Zodra iemand een order start
            of klaarmeld via <strong>/production-order-time</strong>, wordt dit automatisch bijgewerkt op het display.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>ACTIEF</strong> — er loopt een timer op dit order (groen gemarkeerd)</li>
            <li><strong>WACHTEND</strong> — order is geüpload maar nog niet gestart</li>
          </ul>
          <p className="mt-2 text-xs text-green-600">Pollt elke 15 seconden voor updates.</p>
        </div>
      )}

      {slide.type === 'inpakstatistiek' && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-900">
          <p className="font-medium mb-1">Automatische slide (zonder financiële cijfers)</p>
          <p>
            Toont hetzelfde datateam als <strong>/admin/prepack-airtec</strong>: aantal verpakt (Prepack en Airtec
            opgestapeld) en manuren per flow. Standaard periode: <strong>14 dagen</strong>. Vernieuwt ongeveer elke 5 minuten.
          </p>
        </div>
      )}

      {slide.type === 'dagplanning' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-900">
          <p className="font-medium mb-1">Dagplanning (automatisch + handmatig)</p>
          <p>
            Toont automatisch de dagplanning uit het systeem (wie is aanwezig, afwezig, welke machine).
            Vernieuwt elke 5 minuten.
          </p>
          <div className="mt-3">
            <label className="block text-sm font-medium text-orange-800 mb-1">
              Handmatige regels (optioneel, overschrijft automatische data)
            </label>
            <textarea
              value={(slide.content?.manualEntries || []).join('\n')}
              onChange={e => updateContent({ manualEntries: e.target.value.split('\n').filter((l: string) => l.trim()) })}
              rows={6}
              className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder={"Jan — Prepack\nPiet — Airtec — Machine 3\nKarel — Afwezig (verlof)"}
            />
            <p className="text-xs text-orange-600 mt-1">Laat leeg om automatische data te gebruiken.</p>
          </div>
        </div>
      )}

      {slide.type === 'countdown' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doeldatum en -tijd</label>
            <input
              type="datetime-local"
              value={slide.content?.targetDate || ''}
              onChange={e => updateContent({ targetDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving (optioneel)</label>
            <input
              type="text"
              value={slide.content?.description || ''}
              onChange={e => updateContent({ description: e.target.value })}
              placeholder="Bijv. Levering Klant X, Audit, etc."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {slide.type === 'weer' && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-900">
          <p className="font-medium mb-1">Weer (Open-Meteo, geen API-key nodig)</p>
          <p>
            Toont huidige temperatuur, windsnelheid en een mini-forecast. Vernieuwt elke 15 minuten.
          </p>
          <div className="mt-3 flex gap-4">
            <div>
              <label className="block text-xs font-medium text-sky-700 mb-1">Breedtegraad</label>
              <input
                type="number"
                step="0.01"
                value={slide.content?.latitude ?? 51.16}
                onChange={e => updateContent({ latitude: parseFloat(e.target.value) || 51.16 })}
                className="border border-sky-200 rounded-lg px-3 py-2 text-sm w-28"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sky-700 mb-1">Lengtegraad</label>
              <input
                type="number"
                step="0.01"
                value={slide.content?.longitude ?? 4.39}
                onChange={e => updateContent({ longitude: parseFloat(e.target.value) || 4.39 })}
                className="border border-sky-200 rounded-lg px-3 py-2 text-sm w-28"
              />
            </div>
          </div>
          <p className="text-xs text-sky-600 mt-2">Standaard: Wilrijk (51.16, 4.39)</p>
        </div>
      )}

      {slide.type === 'afbeelding' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Afbeelding</label>
          {slide.content?.url && (
            <div className="mb-3">
              <img
                src={slide.content.url}
                alt="Preview"
                className="max-h-48 rounded-lg border"
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploading(true)
              const url = await onUploadImage(file)
              if (url) updateContent({ url })
              setUploading(false)
            }}
            className="text-sm"
          />
          {uploading && <p className="text-sm text-blue-600 mt-1">Uploaden...</p>}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => onSave(slide)}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}
