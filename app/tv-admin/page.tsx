'use client'

import { useState, useEffect, useCallback } from 'react'

type SlideType = 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders' | 'inpakstatistiek' | 'dagplanning' | 'countdown' | 'weer' | 'priorities'

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

const SLIDE_TYPES: Array<{
  value: SlideType
  label: string
  icon: string
  description: string
  color: string
  bgColor: string
}> = [
  { value: 'werkorders', label: 'Werkorders', icon: '📋', description: 'Lijst van werkorders', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  { value: 'tekst', label: 'Tekst / Bericht', icon: '💬', description: 'Vrije tekst op scherm', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  { value: 'afbeelding', label: 'Afbeelding', icon: '🖼️', description: 'Upload een afbeelding', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  { value: 'productieorders', label: 'Productieorders', icon: '⚙️', description: 'Live status van orders', color: 'text-green-700', bgColor: 'bg-green-50' },
  { value: 'inpakstatistiek', label: 'Inpak Statistiek', icon: '📊', description: 'Prepack + Airtec grafiek', color: 'text-teal-800', bgColor: 'bg-teal-50' },
  { value: 'dagplanning', label: 'Dagplanning', icon: '📅', description: 'Wie doet wat vandaag', color: 'text-orange-800', bgColor: 'bg-orange-50' },
  { value: 'countdown', label: 'Countdown', icon: '⏳', description: 'Aftellen naar deadline', color: 'text-rose-700', bgColor: 'bg-rose-50' },
  { value: 'weer', label: 'Weer', icon: '🌤️', description: '7-daags weeroverzicht', color: 'text-sky-700', bgColor: 'bg-sky-50' },
  { value: 'priorities', label: 'Prioriteiten', icon: '⭐', description: 'Prio items Prepack + Airtec', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
]

function getSlideConfig(type: SlideType) {
  return SLIDE_TYPES.find(t => t.value === type) || SLIDE_TYPES[0]
}

function getSlidePreview(slide: TvSlide): string {
  switch (slide.type) {
    case 'werkorders': {
      const lines = (slide.content?.lines || []).filter((l: string) => l.trim())
      return lines.length > 0 ? `${lines.length} werkorder${lines.length !== 1 ? 's' : ''}` : 'Geen werkorders'
    }
    case 'tekst':
      return slide.content?.text?.substring(0, 60) || 'Geen tekst'
    case 'afbeelding':
      return slide.content?.url ? 'Afbeelding geüpload' : 'Geen afbeelding'
    case 'countdown': {
      if (!slide.content?.targetDate) return 'Geen datum ingesteld'
      const target = new Date(slide.content.targetDate)
      return target.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    case 'dagplanning': {
      const manual = slide.content?.manualEntries || []
      return manual.length > 0 ? `${manual.length} handmatige regels` : 'Automatisch uit systeem'
    }
    case 'weer':
      return `Locatie: ${slide.content?.latitude?.toFixed(2) ?? '51.16'}, ${slide.content?.longitude?.toFixed(2) ?? '4.39'}`
    case 'priorities':
      return 'Live prio items uit inpak'
    default:
      return 'Automatisch'
  }
}

export default function TvAdminPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<TvSlide | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
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

  const createSlide = async (type: SlideType) => {
    setSaving(true)
    try {
      const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 0
      const defaultContent = type === 'werkorders'
        ? { lines: [''] }
        : type === 'tekst'
        ? { text: '' }
        : type === 'countdown'
        ? { targetDate: '', description: '' }
        : type === 'dagplanning'
        ? { manualEntries: [] }
        : type === 'weer'
        ? { latitude: 51.16, longitude: 4.39 }
        : type === 'productieorders' || type === 'inpakstatistiek' || type === 'priorities'
        ? {}
        : { url: '' }

      const res = await fetch('/api/tv-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: '', content: defaultContent, sort_order: maxOrder }),
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

  const sortedSlides = [...slides].sort((a, b) => a.sort_order - b.sort_order)
  const activeCount = slides.filter(s => s.active).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Slides laden...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TV Display Beheer</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {slides.length} slide{slides.length !== 1 ? 's' : ''} &middot; {activeCount} actief &middot; Rotatie elke {slides.length > 0 ? 'slide eigen duur' : '15s'}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="/tv-display"
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live Display
              </a>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  showAddForm
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showAddForm ? 'Annuleren' : '+ Nieuwe Slide'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Toast */}
        {saveMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            saveMsg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span>{saveMsg.type === 'success' ? '✓' : '✗'}</span>
            {saveMsg.text}
          </div>
        )}

        {/* Add slide type picker */}
        {showAddForm && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Kies een slide type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SLIDE_TYPES.map(st => (
                <button
                  key={st.value}
                  onClick={() => createSlide(st.value)}
                  disabled={saving}
                  className={`${st.bgColor} rounded-xl p-4 text-left hover:ring-2 hover:ring-blue-400 transition-all disabled:opacity-50 group`}
                >
                  <div className="text-2xl mb-2">{st.icon}</div>
                  <div className={`text-sm font-semibold ${st.color}`}>{st.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{st.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {slides.length === 0 && !showAddForm && (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📺</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Nog geen slides</h3>
            <p className="text-sm text-gray-500 mb-4">Voeg je eerste slide toe om het TV-display in te richten.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Eerste slide toevoegen
            </button>
          </div>
        )}

        {/* Slide list */}
        <div className="space-y-2">
          {sortedSlides.map((slide, idx) => {
            const cfg = getSlideConfig(slide.type)
            const isEditing = editingSlide?.id === slide.id
            const preview = getSlidePreview(slide)

            return (
              <div
                key={slide.id}
                className={`bg-white rounded-xl border transition-all ${
                  isEditing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                } ${!slide.active ? 'opacity-60' : ''}`}
              >
                {/* Slide row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveSlide(slide, 'up')}
                      disabled={idx === 0}
                      className="w-6 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveSlide(slide, 'down')}
                      disabled={idx === sortedSlides.length - 1}
                      className="w-6 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Position number */}
                  <span className="w-6 text-center text-xs font-mono text-gray-400 shrink-0">{idx + 1}</span>

                  {/* Type icon + badge */}
                  <div className={`${cfg.bgColor} rounded-lg w-9 h-9 flex items-center justify-center shrink-0 text-lg`}>
                    {cfg.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate text-sm">
                        {slide.title || <span className="text-gray-400 italic">Geen titel</span>}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bgColor}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-2">
                      <span>{preview}</span>
                      {slide.duration && (
                        <span className="inline-flex items-center gap-0.5 text-gray-400">
                          &middot; {slide.duration}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(slide)}
                    className="shrink-0"
                    title={slide.active ? 'Klik om uit te schakelen' : 'Klik om te activeren'}
                  >
                    <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                      slide.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        slide.active ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingSlide(isEditing ? null : slide)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isEditing
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isEditing ? 'Sluiten' : 'Bewerken'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteSlide(slide.id)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Verwijderen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Editor */}
                {isEditing && (
                  <SlideEditor
                    slide={editingSlide}
                    onChange={setEditingSlide}
                    onSave={async (s) => { await updateSlide(s); setEditingSlide(s) }}
                    onUploadImage={handleImageUpload}
                    saving={saving}
                  />
                )}
              </div>
            )
          })}
        </div>
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
    <div className="px-4 pb-5 pt-3 border-t border-gray-100 space-y-4 bg-gray-50/50">
      {/* Title + duration row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Titel</label>
          <input
            type="text"
            value={slide.title || ''}
            onChange={e => update({ title: e.target.value })}
            placeholder="Optionele titel bovenaan de slide"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Duur</label>
          <div className="relative">
            <input
              type="number"
              min={5}
              max={300}
              value={slide.duration ?? ''}
              onChange={e => update({ duration: e.target.value ? parseInt(e.target.value, 10) : null })}
              placeholder="15"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">sec</span>
          </div>
        </div>
      </div>

      {/* Type-specific content */}
      {slide.type === 'werkorders' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Werkorders (1 per regel)
          </label>
          <textarea
            value={(slide.content?.lines || []).join('\n')}
            onChange={e => updateContent({ lines: e.target.value.split('\n') })}
            rows={8}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder={"PVO26-01234 \u2014 Compressor ABC\nPVO26-05678 \u2014 Motor XYZ"}
          />
        </div>
      )}

      {slide.type === 'tekst' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Bericht</label>
            <textarea
              value={slide.content?.text || ''}
              onChange={e => updateContent({ text: e.target.value })}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Typ hier het bericht voor op de TV..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Lettergrootte</label>
            <div className="flex gap-2">
              {([['medium', 'Normaal'], ['large', 'Groot'], ['xlarge', 'Extra Groot']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => updateContent({ fontSize: val })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    (slide.content?.fontSize || 'large') === val
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {slide.type === 'productieorders' && (
        <ProductieordersPriorityEditor />
      )}

      {slide.type === 'inpakstatistiek' && (
        <InfoBox color="teal" icon="📊" title="Automatische slide">
          Prepack + Airtec: aantal verpakt en manuren (geen financiële cijfers).
          Periode: laatste 14 dagen. Vernieuwt elke minuut.
        </InfoBox>
      )}

      {slide.type === 'priorities' && (
        <InfoBox color="yellow" icon="⭐" title="Automatische prioriteiten">
          Toont live alle items met priority-vlag uit zowel <strong>Prepack</strong> als <strong>Airtec</strong>.
          <strong>Activeert automatisch</strong> wanneer er prio items zijn en verdwijnt weer uit de rotatie zodra alles is afgehandeld.
          Vernieuwt elke 30 seconden.
        </InfoBox>
      )}

      {slide.type === 'dagplanning' && (
        <div className="space-y-3">
          <InfoBox color="orange" icon="📅" title="Dagplanning">
            Toont automatisch wie er aanwezig, afwezig of op verlof is. Vernieuwt elke 5 minuten.
            Optioneel kun je hieronder handmatige regels invoeren die de automatische data overschrijven.
          </InfoBox>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Handmatige regels (optioneel)
            </label>
            <textarea
              value={(slide.content?.manualEntries || []).join('\n')}
              onChange={e => updateContent({ manualEntries: e.target.value.split('\n').filter((l: string) => l.trim()) })}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder={"Jan \u2014 Prepack\nPiet \u2014 Airtec \u2014 Machine 3\nKarel \u2014 Afwezig (verlof)"}
            />
            <p className="text-xs text-gray-400 mt-1">Laat leeg voor automatische data uit het systeem.</p>
          </div>
        </div>
      )}

      {slide.type === 'countdown' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Doeldatum en -tijd</label>
            <input
              type="datetime-local"
              value={slide.content?.targetDate || ''}
              onChange={e => updateContent({ targetDate: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Beschrijving</label>
            <input
              type="text"
              value={slide.content?.description || ''}
              onChange={e => updateContent({ description: e.target.value })}
              placeholder="Bijv. Levering Klant X, Audit, etc."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {slide.type === 'weer' && (
        <div className="space-y-3">
          <InfoBox color="sky" icon="🌤️" title="Weerdata via Open-Meteo">
            7-daags weeroverzicht met temperatuur, neerslag en wind. Vernieuwt elke 15 minuten. Geen API-key nodig.
          </InfoBox>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Breedtegraad</label>
              <input
                type="number"
                step="0.01"
                value={slide.content?.latitude ?? 51.16}
                onChange={e => updateContent({ latitude: parseFloat(e.target.value) || 51.16 })}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Lengtegraad</label>
              <input
                type="number"
                step="0.01"
                value={slide.content?.longitude ?? 4.39}
                onChange={e => updateContent({ longitude: parseFloat(e.target.value) || 4.39 })}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Standaard: Wilrijk (51.16, 4.39)</p>
        </div>
      )}

      {slide.type === 'afbeelding' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Afbeelding</label>
          {slide.content?.url && (
            <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.content.url} alt="Preview" className="max-h-48 object-contain" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}>
              {uploading ? 'Uploaden...' : slide.content?.url ? 'Andere afbeelding kiezen' : 'Afbeelding uploaden'}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const url = await onUploadImage(file)
                  if (url) updateContent({ url })
                  setUploading(false)
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-gray-400">
          Laatst bijgewerkt: {new Date(slide.updated_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <button
          onClick={() => onSave(slide)}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}

interface ProdOrder {
  order_number: string
  sales_order_number: string | null
  due_date: string | null
  tv_priority: number
  status: 'in_progress' | 'waiting'
  lines: Array<{ item_number: string; description: string | null; quantity: number }>
}

function ProductieordersPriorityEditor() {
  const [orders, setOrders] = useState<ProdOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [savingOrder, setSavingOrder] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/production-status')
      const json = await res.json()
      setOrders(json.orders || [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const setPriority = async (orderNumber: string, priority: number) => {
    setSavingOrder(orderNumber)
    setMsg(null)
    try {
      const res = await fetch('/api/tv-slides/production-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber, tv_priority: priority }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Opslaan mislukt')
      }
      setOrders(prev => prev.map(o =>
        o.order_number === orderNumber ? { ...o, tv_priority: priority } : o
      ))
      setMsg({ type: 'success', text: `Prioriteit ${orderNumber} bijgewerkt` })
      setTimeout(() => setMsg(null), 2000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSavingOrder(null)
    }
  }

  const movePriority = async (orderNumber: string, direction: 'up' | 'down') => {
    const sorted = [...orders].sort((a, b) => b.tv_priority - a.tv_priority)
    const idx = sorted.findIndex(o => o.order_number === orderNumber)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const current = sorted[idx]
    const other = sorted[swapIdx]

    const newCurrentPrio = other.tv_priority
    const newOtherPrio = current.tv_priority

    await Promise.all([
      setPriority(current.order_number, newCurrentPrio),
      setPriority(other.order_number, newOtherPrio),
    ])
    fetchOrders()
  }

  const PRIO_LEVELS = [
    { value: 3, label: 'URGENT', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 2, label: 'HOOG', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    { value: 1, label: 'NORMAAL', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 0, label: 'GEEN', color: 'bg-gray-100 text-gray-500 border-gray-300' },
  ]

  if (loading) {
    return <div className="text-sm text-gray-500 py-4 text-center">Orders laden...</div>
  }

  return (
    <div className="space-y-3">
      <InfoBox color="green" icon="⚙️" title="Productieorders + Prioriteiten">
        Toont live de actieve productieorders. Stel hieronder de prioriteit in per order.
        Orders met hogere prioriteit worden bovenaan getoond op het display met een duidelijke markering.
      </InfoBox>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {msg.text}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          Geen actieve productieorders gevonden
        </div>
      ) : (
        <div className="space-y-2">
          {[...orders].sort((a, b) => b.tv_priority - a.tv_priority).map((order, idx) => {
            const prioConfig = PRIO_LEVELS.find(p => p.value === order.tv_priority) || PRIO_LEVELS[3]
            const isSaving = savingOrder === order.order_number
            return (
              <div
                key={order.order_number}
                className={`border rounded-lg p-3 transition-all ${
                  order.tv_priority >= 3 ? 'border-red-300 bg-red-50/50' :
                  order.tv_priority >= 2 ? 'border-orange-300 bg-orange-50/30' :
                  order.tv_priority >= 1 ? 'border-blue-200 bg-blue-50/30' :
                  'border-gray-200 bg-white'
                } ${isSaving ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => movePriority(order.order_number, 'up')}
                      disabled={idx === 0 || isSaving}
                      className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 text-[10px]"
                    >▲</button>
                    <button
                      onClick={() => movePriority(order.order_number, 'down')}
                      disabled={idx === orders.length - 1 || isSaving}
                      className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 text-[10px]"
                    >▼</button>
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{order.order_number}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        order.status === 'in_progress'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {order.status === 'in_progress' ? 'ACTIEF' : 'WACHTEND'}
                      </span>
                      {order.due_date && (
                        <span className="text-xs text-gray-400">
                          Deadline: {new Date(order.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {order.lines.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {order.lines.map(l => `${l.quantity}x ${l.item_number}`).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Prioriteit knoppen */}
                  <div className="flex gap-1 shrink-0">
                    {PRIO_LEVELS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(order.order_number, p.value)}
                        disabled={isSaving}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          order.tv_priority === p.value
                            ? p.color + ' ring-1 ring-offset-1'
                            : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InfoBox({ color, icon, title, children }: { color: string; icon: string; title: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    teal: 'bg-teal-50 border-teal-200 text-teal-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    sky: 'bg-sky-50 border-sky-200 text-sky-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }
  return (
    <div className={`border rounded-lg p-3 text-sm ${colorMap[color] || colorMap.green}`}>
      <div className="flex items-center gap-2 font-semibold mb-1">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-xs leading-relaxed opacity-80">{children}</p>
    </div>
  )
}
