'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_SITE, SITES, type Site } from '@/lib/sites'

type SlideType = 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders' | 'inpakstatistiek' | 'dagplanning' | 'countdown' | 'weer' | 'priorities' | 'transportplanning'

interface TvScreen {
  id: string
  slug: string
  name: string
  site: string
  active: boolean
  screen_group: string
  last_seen_at: string | null
  updated_at: string | null
  created_at: string
  slideCount: number
}

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

interface ScreenHealth {
  linkedSlides: number
  activeSlides: number
  dagplanningEntries: number
  openProductionOrders: number
  priorityItems: number
  checkedAt: string
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
  { value: 'transportplanning', label: 'Planning', icon: '📋', description: 'Weekoverzicht planning', color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
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
    case 'inpakstatistiek':
      return `Punten per €${slide.content?.pointRate || 50} marge`
    case 'transportplanning':
      return 'Weekkalender transporten'
    case 'priorities':
      return 'Live prio items uit inpak'
    default:
      return 'Automatisch'
  }
}

function formatRelative(value: string | null): string {
  if (!value) return 'nog niet online'
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 0) return 'net'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'minder dan 1 min geleden'
  if (minutes < 60) return `${minutes} min geleden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} u geleden`
  return new Date(value).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isScreenOnline(value: string | null): boolean {
  if (!value) return false
  return Date.now() - new Date(value).getTime() < 90_000
}

export default function TvAdminPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<TvSlide | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [screens, setScreens] = useState<TvScreen[]>([])
  const [showScreenManager, setShowScreenManager] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenSlug, setNewScreenSlug] = useState('')
  const [newScreenSite, setNewScreenSite] = useState<Site>(DEFAULT_SITE)
  const [newScreenGroup, setNewScreenGroup] = useState('Bureau')
  const [templateScreenId, setTemplateScreenId] = useState('')
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null)
  const [screenSlideIds, setScreenSlideIds] = useState<string[]>([])
  const [screenHealth, setScreenHealth] = useState<ScreenHealth | null>(null)
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)

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

  const fetchScreens = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-screens')
      const json = await res.json()
      setScreens(json.data || [])
    } catch (e) {
      console.error('Fout bij laden schermen:', e)
    }
  }, [])

  const fetchScreenSlides = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/tv-screens/${slug}/slides`)
      const json = await res.json()
      setScreenSlideIds((json.data || []).map((s: any) => s.id))
    } catch {
      setScreenSlideIds([])
    }
  }, [])

  const fetchScreenHealth = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/tv-screens/${slug}/health`)
      const json = await res.json()
      setScreenHealth(res.ok ? json : null)
    } catch {
      setScreenHealth(null)
    }
  }, [])

  useEffect(() => { fetchSlides(); fetchScreens() }, [fetchSlides, fetchScreens])

  useEffect(() => {
    if (selectedScreen) {
      const screen = screens.find(s => s.id === selectedScreen)
      if (screen) {
        fetchScreenSlides(screen.slug)
        fetchScreenHealth(screen.slug)
      }
    } else {
      setScreenSlideIds([])
      setScreenHealth(null)
    }
  }, [selectedScreen, screens, fetchScreenSlides, fetchScreenHealth])

  useEffect(() => {
    if (!showScreenManager) return
    const timer = setInterval(() => {
      fetchScreens()
      const screen = screens.find(s => s.id === selectedScreen)
      if (screen) fetchScreenHealth(screen.slug)
    }, 30000)
    return () => clearInterval(timer)
  }, [fetchScreens, fetchScreenHealth, screens, selectedScreen, showScreenManager])

  const saveScreenSlides = async (screen: TvScreen, slideIds: string[]) => {
    setScreenSlideIds(slideIds)
    await fetch(`/api/tv-screens/${screen.slug}/slides`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideIds }),
    })
    fetchScreens()
    fetchScreenHealth(screen.slug)
  }

  const createScreen = async () => {
    if (!newScreenName.trim()) return
    const slug = newScreenSlug.trim() || newScreenName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    try {
      const res = await fetch('/api/tv-screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: newScreenName.trim(),
          site: newScreenSite,
          screen_group: newScreenGroup,
        }),
      })
      const json = await res.json()
      if (json.data) {
        setScreens(prev => [...prev, { ...json.data, slideCount: 0 }])
        const templateScreen = screens.find(screen => screen.id === templateScreenId)
        if (templateScreen) {
          const templateRes = await fetch(`/api/tv-screens/${templateScreen.slug}/slides`)
          const templateJson = await templateRes.json()
          const templateIds = (templateJson.data || []).map((slide: any) => slide.id)
          if (templateIds.length > 0) {
            await fetch(`/api/tv-screens/${json.data.slug}/slides`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slideIds: templateIds }),
            })
          }
        }
        setNewScreenName('')
        setNewScreenSlug('')
        setNewScreenSite(DEFAULT_SITE)
        setNewScreenGroup('Bureau')
        setTemplateScreenId('')
        fetchScreens()
        setSaveMsg({ type: 'success', text: `Scherm "${json.data.name}" aangemaakt` })
        setTimeout(() => setSaveMsg(null), 3000)
      } else {
        setSaveMsg({ type: 'error', text: json.error || 'Aanmaken mislukt' })
      }
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message })
    }
  }

  const deleteScreen = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit scherm wilt verwijderen?')) return
    await fetch('/api/tv-screens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setScreens(prev => prev.filter(s => s.id !== id))
    if (selectedScreen === id) setSelectedScreen(null)
  }

  const toggleSlideForScreen = async (slideId: string) => {
    const screen = screens.find(s => s.id === selectedScreen)
    if (!screen) return
    const newIds = screenSlideIds.includes(slideId)
      ? screenSlideIds.filter(id => id !== slideId)
      : [...screenSlideIds, slideId]
    try { await saveScreenSlides(screen, newIds) } catch { /* silent */ }
  }

  const updateScreen = async (screen: TvScreen, updates: Partial<TvScreen>) => {
    const res = await fetch('/api/tv-screens', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: screen.id, ...updates }),
    })
    const json = await res.json()
    if (!res.ok) {
      setSaveMsg({ type: 'error', text: json.error || 'Scherm bijwerken mislukt' })
      return
    }
    setScreens(prev => prev.map(s => s.id === screen.id ? { ...s, ...json.data, slideCount: s.slideCount } : s))
    setSaveMsg({ type: 'success', text: 'Scherm bijgewerkt' })
    setTimeout(() => setSaveMsg(null), 2500)
  }

  const moveScreenSlide = async (targetSlideId: string) => {
    const screen = screens.find(s => s.id === selectedScreen)
    if (!screen || !draggedSlideId || draggedSlideId === targetSlideId) return
    const from = screenSlideIds.indexOf(draggedSlideId)
    const to = screenSlideIds.indexOf(targetSlideId)
    if (from === -1 || to === -1) return
    const next = [...screenSlideIds]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraggedSlideId(null)
    await saveScreenSlides(screen, next)
  }

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
        : type === 'inpakstatistiek'
        ? { pointRate: 50 }
        : type === 'transportplanning' || type === 'productieorders' || type === 'priorities'
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
  const selectedScreenData = screens.find(s => s.id === selectedScreen) || null
  const selectedScreenSlides = screenSlideIds
    .map(id => slides.find(slide => slide.id === id))
    .filter(Boolean) as TvSlide[]
  const selectedActiveSlideCount = selectedScreenSlides.filter(slide => slide.active).length

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
        <div className="w-full px-4 py-4 2xl:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TV Display Beheer</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {slides.length} slide{slides.length !== 1 ? 's' : ''} &middot; {activeCount} actief &middot; {screens.length} scherm{screens.length !== 1 ? 'en' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowScreenManager(!showScreenManager)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  showScreenManager ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showScreenManager ? 'Schermen sluiten' : 'Schermen'}
              </button>
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

      <div className="w-full px-4 py-6 2xl:px-8">
        {/* Screen Manager */}
        {showScreenManager && (
          <div className="mb-6 bg-white rounded-xl border border-indigo-200 p-5">
            <h2 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide mb-3">TV Schermen</h2>

            {/* Bestaande schermen */}
            {screens.length > 0 && (
              <div className="space-y-2 mb-4">
                {screens.map(screen => (
                  <div
                    key={screen.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedScreen === screen.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedScreen(selectedScreen === screen.id ? null : screen.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold shrink-0">
                      {screen.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-sm text-gray-900">{screen.name}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          screen.active !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {screen.active !== false ? 'Actief' : 'Gepauzeerd'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isScreenOnline(screen.last_seen_at) ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {isScreenOnline(screen.last_seen_at) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">/tv-display/{screen.slug}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          {screen.site || DEFAULT_SITE}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {screen.screen_group || 'Algemeen'}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          laatste update {formatRelative(screen.last_seen_at)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{screen.slideCount} slides</span>
                    <button
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/tv-display/${screen.slug}`) }}
                      className="shrink-0 px-2 py-1 rounded text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Kopieer URL"
                    >
                      URL
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteScreen(screen.id) }}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Slide toewijzing voor geselecteerd scherm */}
            {selectedScreen && (
              <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                {selectedScreenData && (
                  <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_340px]">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                            Slides voor: {selectedScreenData.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {selectedScreenData.screen_group || 'Algemeen'} - {selectedScreenData.site || DEFAULT_SITE} - laatste heartbeat {formatRelative(selectedScreenData.last_seen_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateScreen(selectedScreenData, { active: selectedScreenData.active === false })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            selectedScreenData.active !== false
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {selectedScreenData.active !== false ? 'Pauzeer scherm' : 'Activeer scherm'}
                        </button>
                      </div>

                      {selectedActiveSlideCount === 0 && (
                        <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-800">
                          Dit scherm toont nu niets: er zijn geen gekoppelde actieve slides.
                        </div>
                      )}

                      {screenHealth && (
                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                          <HealthPill label="Actieve slides" value={screenHealth.activeSlides} />
                          <HealthPill label="Dagplanning" value={screenHealth.dagplanningEntries} />
                          <HealthPill label="Productieorders" value={screenHealth.openProductionOrders} />
                          <HealthPill label="Prio's" value={screenHealth.priorityItems} />
                          <HealthPill label="Check" value={formatRelative(screenHealth.checkedAt)} />
                        </div>
                      )}

                      <div className="mb-3 grid gap-2 md:grid-cols-3">
                        <input
                          value={selectedScreenData.name}
                          onChange={e => updateScreen(selectedScreenData, { name: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Schermnaam"
                        />
                        <select
                          value={selectedScreenData.site || DEFAULT_SITE}
                          onChange={e => updateScreen(selectedScreenData, { site: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {SITES.map(siteOption => (
                            <option key={siteOption} value={siteOption}>{siteOption}</option>
                          ))}
                        </select>
                        <select
                          value={selectedScreenData.screen_group || 'Algemeen'}
                          onChange={e => updateScreen(selectedScreenData, { screen_group: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {['Bureau', 'Productie', 'Inpak', 'Magazijn', 'Algemeen'].map(group => (
                            <option key={group} value={group}>{group}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Gekoppelde slides - sleep om volgorde te wijzigen
                      </div>
                      <div className="mb-3 space-y-1">
                        {selectedScreenSlides.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                            Nog geen slides gekoppeld.
                          </div>
                        ) : (
                          selectedScreenSlides.map(slide => {
                            const cfg = getSlideConfig(slide.type)
                            return (
                              <div
                                key={slide.id}
                                draggable
                                onDragStart={() => setDraggedSlideId(slide.id)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => moveScreenSlide(slide.id)}
                                className="flex cursor-move items-center gap-2 rounded-lg bg-white p-2 text-sm shadow-sm"
                              >
                                <span className="text-gray-400">↕</span>
                                <span>{cfg.icon}</span>
                                <span className="flex-1 truncate font-medium text-gray-900">{slide.title || cfg.label}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bgColor}`}>{cfg.label}</span>
                                {slide.active === false && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">inactief</span>}
                                <button
                                  type="button"
                                  onClick={() => toggleSlideForScreen(slide.id)}
                                  className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Loskoppelen
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>

                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Beschikbare slides toevoegen
                      </div>
                      <div className="grid gap-1 md:grid-cols-2">
                        {sortedSlides.filter(slide => !screenSlideIds.includes(slide.id)).map(slide => {
                          const cfg = getSlideConfig(slide.type)
                          return (
                            <button
                              key={slide.id}
                              type="button"
                              onClick={() => toggleSlideForScreen(slide.id)}
                              className="flex items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-white"
                            >
                              <span>{cfg.icon}</span>
                              <span className="flex-1 truncate">{slide.title || cfg.label}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bgColor}`}>{cfg.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Live preview</div>
                        <a href={`/tv-display/${selectedScreenData.slug}`} target="_blank" className="text-xs font-semibold text-indigo-600 hover:underline">
                          Open groot
                        </a>
                      </div>
                      <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                        <iframe
                          src={`/tv-display/${selectedScreenData.slug}`}
                          title={`Preview ${selectedScreenData.name}`}
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nieuw scherm */}
            <div className="grid gap-2 md:grid-cols-[1fr_160px_140px_140px_160px_auto]">
              <input
                type="text"
                value={newScreenName}
                onChange={e => {
                  setNewScreenName(e.target.value)
                  if (!newScreenSlug || newScreenSlug === newScreenName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')) {
                    setNewScreenSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))
                  }
                }}
                placeholder="Naam (bv. Productiehal)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <input
                type="text"
                value={newScreenSlug}
                onChange={e => setNewScreenSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="slug"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <select
                value={newScreenSite}
                onChange={e => setNewScreenSite(e.target.value as Site)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {SITES.map(siteOption => (
                  <option key={siteOption} value={siteOption}>{siteOption}</option>
                ))}
              </select>
              <select
                value={newScreenGroup}
                onChange={e => setNewScreenGroup(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {['Bureau', 'Productie', 'Inpak', 'Magazijn', 'Algemeen'].map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
              <select
                value={templateScreenId}
                onChange={e => setTemplateScreenId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="">Geen template</option>
                {screens.map(screen => (
                  <option key={screen.id} value={screen.id}>Kopieer {screen.name}</option>
                ))}
              </select>
              <button
                onClick={createScreen}
                disabled={!newScreenName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                + Scherm
              </button>
            </div>
          </div>
        )}
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

function HealthPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white px-3 py-2 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div>
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
        <div className="w-56">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Duur: {slide.duration ?? 15}s
          </label>
          <div className="relative">
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={slide.duration ?? 15}
              onChange={e => update({ duration: parseInt(e.target.value, 10) })}
              className="w-full accent-blue-600"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-medium text-gray-400">
            <span>5s</span>
            <button type="button" onClick={() => update({ duration: null })} className="text-blue-600 hover:underline">standaard 15s</button>
            <span>120s</span>
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
        <div className="space-y-3">
          <InfoBox color="teal" icon="📊" title="Automatische slide">
            Prepack + Airtec: aantal verpakt, manuren en marge-score.
            Periode: laatste 14 dagen. Vernieuwt elke minuut.
          </InfoBox>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Puntentarief (euro per punt)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={slide.content?.pointRate ?? 50}
                onChange={e => updateContent({ pointRate: Math.max(1, parseInt(e.target.value, 10) || 50) })}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-xs text-gray-500">
                Score = marge / {slide.content?.pointRate || 50} — hoger tarief = lagere scores
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Voorbeeld: bij tarief 50 levert een marge van €500 een score van 10 punten op.
            </p>
          </div>
        </div>
      )}

      {slide.type === 'transportplanning' && (
        <TransportPlanningEditor />
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
  const [saving, setSaving] = useState(false)
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

  const sortedOrders = [...orders].sort((a, b) => {
    const pa = a.tv_priority || 0
    const pb = b.tv_priority || 0
    if (pa > 0 && pb > 0) return pa - pb
    if (pa > 0) return -1
    if (pb > 0) return 1
    return 0
  })

  const savePriority = async (orderNumber: string, priority: number) => {
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
    } catch (err: any) {
      throw err
    }
  }

  const moveOrder = async (orderNumber: string, direction: 'up' | 'down') => {
    setSaving(true)
    setMsg(null)

    const ranked = sortedOrders.filter(o => (o.tv_priority || 0) > 0)
    const unranked = sortedOrders.filter(o => (o.tv_priority || 0) === 0)
    const idx = ranked.findIndex(o => o.order_number === orderNumber)

    if (direction === 'up') {
      if (idx <= 0) { setSaving(false); return }
      const temp = ranked[idx]
      ranked[idx] = ranked[idx - 1]
      ranked[idx - 1] = temp
    } else {
      if (idx < 0 || idx >= ranked.length - 1) { setSaving(false); return }
      const temp = ranked[idx]
      ranked[idx] = ranked[idx + 1]
      ranked[idx + 1] = temp
    }

    try {
      const updates = ranked.map((o, i) => savePriority(o.order_number, i + 1))
      await Promise.all(updates)
      const newOrders = [...ranked.map((o, i) => ({ ...o, tv_priority: i + 1 })), ...unranked]
      setOrders(newOrders)
      setMsg({ type: 'success', text: 'Volgorde bijgewerkt' })
      setTimeout(() => setMsg(null), 2000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const addToRanking = async (orderNumber: string) => {
    setSaving(true)
    setMsg(null)
    const ranked = sortedOrders.filter(o => (o.tv_priority || 0) > 0)
    const newRank = ranked.length + 1
    try {
      await savePriority(orderNumber, newRank)
      setOrders(prev => prev.map(o =>
        o.order_number === orderNumber ? { ...o, tv_priority: newRank } : o
      ))
      setMsg({ type: 'success', text: `${orderNumber} toegevoegd als #${newRank}` })
      setTimeout(() => setMsg(null), 2000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const removeFromRanking = async (orderNumber: string) => {
    setSaving(true)
    setMsg(null)
    try {
      await savePriority(orderNumber, 0)
      const remaining = sortedOrders
        .filter(o => (o.tv_priority || 0) > 0 && o.order_number !== orderNumber)
      const updates = remaining.map((o, i) => savePriority(o.order_number, i + 1))
      await Promise.all(updates)
      setOrders(prev => {
        const updated = prev.map(o => {
          if (o.order_number === orderNumber) return { ...o, tv_priority: 0 }
          const newIdx = remaining.findIndex(r => r.order_number === o.order_number)
          if (newIdx >= 0) return { ...o, tv_priority: newIdx + 1 }
          return o
        })
        return updated
      })
      setMsg({ type: 'success', text: `${orderNumber} verwijderd uit ranking` })
      setTimeout(() => setMsg(null), 2000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-4 text-center">Orders laden...</div>
  }

  const ranked = sortedOrders.filter(o => (o.tv_priority || 0) > 0)
  const unranked = sortedOrders.filter(o => (o.tv_priority || 0) === 0)

  return (
    <div className="space-y-3">
      <InfoBox color="green" icon="⚙️" title="Productieorders — Volgorde">
        Rangschik de productieorders op prioriteit. #1 = hoogste prioriteit en wordt bovenaan getoond op het display.
        Gebruik de pijltjes om de volgorde aan te passen.
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
        <>
          {/* Gerangschikte orders */}
          {ranked.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Prioriteit volgorde</div>
              <div className="space-y-1.5">
                {ranked.map((order, idx) => {
                  const isSaving = saving
                  return (
                    <div
                      key={order.order_number}
                      className={`border rounded-lg p-3 transition-all ${
                        idx === 0 ? 'border-amber-400 bg-amber-50/60' :
                        idx === 1 ? 'border-gray-300 bg-gray-50/60' :
                        idx === 2 ? 'border-orange-300 bg-orange-50/40' :
                        'border-gray-200 bg-white'
                      } ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveOrder(order.order_number, 'up')}
                            disabled={idx === 0 || isSaving}
                            className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 text-[10px]"
                          >▲</button>
                          <button
                            onClick={() => moveOrder(order.order_number, 'down')}
                            disabled={idx === ranked.length - 1 || isSaving}
                            className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 text-[10px]"
                          >▼</button>
                        </div>

                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          idx === 2 ? 'bg-orange-400 text-white' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{order.order_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              order.status === 'in_progress' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {order.status === 'in_progress' ? 'ACTIEF' : 'WACHTEND'}
                            </span>
                            {order.due_date && (
                              <span className="text-xs text-gray-400">
                                {new Date(order.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                          {order.lines.length > 0 && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {order.lines.map(l => `${l.quantity}x ${l.item_number}`).join(', ')}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromRanking(order.order_number)}
                          disabled={isSaving}
                          className="shrink-0 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Verwijder uit ranking"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Niet-gerangschikte orders */}
          {unranked.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Zonder prioriteit {ranked.length > 0 && <span className="text-gray-400 normal-case font-normal">— klik + om toe te voegen</span>}
              </div>
              <div className="space-y-1.5">
                {unranked.map(order => (
                  <div
                    key={order.order_number}
                    className={`border border-dashed border-gray-200 rounded-lg p-3 bg-white ${saving ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 border border-dashed border-gray-300 shrink-0 text-sm">
                        —
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-700">{order.order_number}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.status === 'in_progress' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {order.status === 'in_progress' ? 'ACTIEF' : 'WACHTEND'}
                          </span>
                        </div>
                        {order.lines.length > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {order.lines.map(l => `${l.quantity}x ${l.item_number}`).join(', ')}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => addToRanking(order.order_number)}
                        disabled={saving}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        + Prioriteit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const TRANSPORT_TYPES = [
  { value: 'eigen', label: 'Eigen transport', color: 'bg-green-100 text-green-700' },
  { value: 'extern', label: 'Externe transporteur', color: 'bg-blue-100 text-blue-700' },
  { value: 'ophaling', label: 'Ophaling door klant', color: 'bg-orange-100 text-orange-700' },
] as const

interface TransportEntry {
  id: string
  transport_date: string
  transport_type: 'eigen' | 'extern' | 'ophaling'
  destination: string | null
  description: string | null
  transporter_name: string | null
  notes: string | null
}

function TransportPlanningEditor() {
  const [entries, setEntries] = useState<TransportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekLabel, setWeekLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formDate, setFormDate] = useState('')
  const [formType, setFormType] = useState<'eigen' | 'extern' | 'ophaling'>('eigen')
  const [formDestination, setFormDestination] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTransporter, setFormTransporter] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tv-slides/transport-planning?weekOffset=${weekOffset}`)
      const json = await res.json()
      setEntries(json.data || [])
      if (json.weekFrom && json.weekTo) {
        const fmtNl = (d: string) => new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
        setWeekLabel(`${fmtNl(json.weekFrom)} — ${fmtNl(json.weekTo)}`)
      }
    } catch { setEntries([]) }
    finally { setLoading(false) }
  }, [weekOffset])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const resetForm = () => {
    setEditingId(null)
    setFormDate('')
    setFormType('eigen')
    setFormDestination('')
    setFormDescription('')
    setFormTransporter('')
    setFormNotes('')
  }

  const startEdit = (entry: TransportEntry) => {
    setEditingId(entry.id)
    setFormDate(entry.transport_date)
    setFormType(entry.transport_type)
    setFormDestination(entry.destination || '')
    setFormDescription(entry.description || '')
    setFormTransporter(entry.transporter_name || '')
    setFormNotes(entry.notes || '')
  }

  const saveEntry = async () => {
    if (!formDate) { setMsg({ type: 'error', text: 'Datum is verplicht' }); return }
    setSaving(true)
    setMsg(null)
    const body = {
      transport_date: formDate,
      transport_type: formType,
      destination: formDestination || null,
      description: formDescription || null,
      transporter_name: formTransporter || null,
      notes: formNotes || null,
    }
    try {
      const res = editingId
        ? await fetch('/api/tv-slides/transport-planning', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...body }) })
        : await fetch('/api/tv-slides/transport-planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Opslaan mislukt')
      setMsg({ type: 'success', text: editingId ? 'Bijgewerkt' : 'Toegevoegd' })
      setTimeout(() => setMsg(null), 2000)
      resetForm()
      fetchEntries()
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Verwijderen?')) return
    try {
      await fetch('/api/tv-slides/transport-planning', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      fetchEntries()
    } catch { /* silent */ }
  }

  const weekDays = (() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOff + weekOffset * 7)
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  })()

  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr']

  return (
    <div className="space-y-3">
      <InfoBox color="indigo" icon="📋" title="Planning">
        Voeg items toe per dag. Op het TV display verschijnt dit als een weekoverzicht.
      </InfoBox>

      {/* Week navigatie */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w - 1)} className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 transition-colors">← Vorige</button>
        <div className="text-sm font-medium text-gray-700">
          {weekLabel}
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="ml-2 text-xs text-indigo-600 hover:underline">Vandaag</button>}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 transition-colors">Volgende →</button>
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-4 text-center">Laden...</div>
      ) : (
        <div className="space-y-2">
          {weekDays.map((date, dayIdx) => {
            const dayEntries = entries.filter(e => e.transport_date === date)
            const isToday = date === new Date().toISOString().split('T')[0]
            return (
              <div key={date} className={`border rounded-lg p-3 ${isToday ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-600 uppercase w-6">{dayNames[dayIdx]}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">VANDAAG</span>}
                  <button
                    onClick={() => { resetForm(); setFormDate(date) }}
                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Toevoegen
                  </button>
                </div>
                {dayEntries.length === 0 && (
                  <div className="text-xs text-gray-400 italic">Geen transporten</div>
                )}
                {dayEntries.map(entry => {
                  const tc = TRANSPORT_TYPES.find(t => t.value === entry.transport_type)
                  return (
                    <div key={entry.id} className="flex items-start gap-2 py-1.5 border-t border-gray-100 first:border-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${tc?.color || 'bg-gray-100 text-gray-700'}`}>
                        {tc?.label || entry.transport_type}
                      </span>
                      <div className="flex-1 min-w-0 text-xs">
                        {entry.destination && <span className="font-medium text-gray-900">{entry.destination}</span>}
                        {entry.description && <span className="text-gray-600"> — {entry.description}</span>}
                        {entry.transporter_name && <span className="text-gray-500"> ({entry.transporter_name})</span>}
                        {entry.notes && <div className="text-gray-400 italic mt-0.5">{entry.notes}</div>}
                      </div>
                      <button onClick={() => startEdit(entry)} className="text-xs text-gray-400 hover:text-indigo-600 shrink-0">Bewerk</button>
                      <button onClick={() => deleteEntry(entry.id)} className="text-xs text-gray-400 hover:text-red-600 shrink-0">✕</button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Formulier */}
      {formDate && (
        <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            {editingId ? 'Transport bewerken' : 'Nieuw transport'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Datum</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as any)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {TRANSPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bestemming</label>
              <input type="text" value={formDestination} onChange={e => setFormDestination(e.target.value)} placeholder="Bv. Willebroek"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Transporteur</label>
              <input type="text" value={formTransporter} onChange={e => setFormTransporter(e.target.value)} placeholder="Naam chauffeur/bedrijf"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Omschrijving</label>
            <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Wat wordt er getransporteerd?"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Opmerkingen</label>
            <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optioneel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveEntry} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
              {saving ? 'Opslaan...' : editingId ? 'Bijwerken' : 'Toevoegen'}
            </button>
            <button onClick={resetForm}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
              Annuleren
            </button>
          </div>
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
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
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
