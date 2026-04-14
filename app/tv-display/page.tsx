'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface TvSlide {
  id: string
  type: 'werkorders' | 'tekst' | 'afbeelding'
  title: string | null
  content: any
  sort_order: number
  active: boolean
}

const ROTATION_INTERVAL = 15000

export default function TvDisplayPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState('')
  const [date, setDate] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSlides = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides')
      const json = await res.json()
      const active = (json.data || [])
        .filter((s: TvSlide) => s.active)
        .sort((a: TvSlide, b: TvSlide) => a.sort_order - b.sort_order)
      setSlides(active)
    } catch (e) {
      console.error('Fout bij laden slides:', e)
    }
  }, [])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('tv-slides-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_slides' }, () => {
        fetchSlides()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchSlides])

  // Auto-rotatie
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (slides.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % slides.length)
      }, ROTATION_INTERVAL)
    } else {
      setCurrentIndex(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [slides.length])

  // Reset index als slides veranderen
  useEffect(() => {
    if (currentIndex >= slides.length) setCurrentIndex(0)
  }, [slides.length, currentIndex])

  // Klok
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))
      setDate(now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }))
    }
    updateClock()
    const interval = setInterval(updateClock, 10000)
    return () => clearInterval(interval)
  }, [])

  const currentSlide = slides[currentIndex] || null

  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-lg font-semibold tracking-wide text-gray-300">PRODUCTIE DISPLAY</span>
        </div>
        {slides.length > 1 && (
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-blue-400' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{clock}</div>
          <div className="text-sm text-gray-400 capitalize">{date}</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        {!currentSlide ? (
          <div className="text-gray-600 text-2xl">Geen actieve slides</div>
        ) : currentSlide.type === 'werkorders' ? (
          <WerkordersSlide slide={currentSlide} />
        ) : currentSlide.type === 'tekst' ? (
          <TekstSlide slide={currentSlide} />
        ) : currentSlide.type === 'afbeelding' ? (
          <AfbeeldingSlide slide={currentSlide} />
        ) : null}
      </div>

      {/* Slide title bar */}
      {currentSlide?.title && (
        <div className="shrink-0 px-8 py-3 bg-gray-900/60 border-t border-gray-800 text-center text-gray-400 text-sm font-medium">
          {currentSlide.title}
        </div>
      )}
    </div>
  )
}

function WerkordersSlide({ slide }: { slide: TvSlide }) {
  const lines: string[] = (slide.content?.lines || []).filter((l: string) => l.trim())

  if (lines.length === 0) {
    return <div className="text-gray-500 text-xl">Geen werkorders ingevoerd</div>
  }

  return (
    <div className="w-full max-w-4xl">
      {slide.title && (
        <h2 className="text-3xl font-bold text-center mb-6 text-white">{slide.title}</h2>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-700">
            <th className="text-left py-3 px-4 text-blue-400 text-lg font-semibold w-16">#</th>
            <th className="text-left py-3 px-4 text-blue-400 text-lg font-semibold">Werkorder</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={`border-b border-gray-800 ${i === 0 ? 'bg-blue-950/40' : ''}`}>
              <td className="py-4 px-4 text-gray-500 text-xl font-mono">{i + 1}</td>
              <td className={`py-4 px-4 text-xl ${i === 0 ? 'text-blue-300 font-bold text-2xl' : 'text-gray-200'}`}>
                {line}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TekstSlide({ slide }: { slide: TvSlide }) {
  const text = slide.content?.text || ''
  const fontSize = slide.content?.fontSize || 'large'

  const sizeClass =
    fontSize === 'xlarge' ? 'text-6xl' :
    fontSize === 'large' ? 'text-4xl' :
    'text-2xl'

  return (
    <div className="max-w-4xl text-center px-8">
      {slide.title && (
        <h2 className="text-3xl font-bold mb-8 text-blue-400">{slide.title}</h2>
      )}
      <p className={`${sizeClass} font-medium leading-relaxed whitespace-pre-wrap`}>
        {text || <span className="text-gray-600">Geen tekst</span>}
      </p>
    </div>
  )
}

function AfbeeldingSlide({ slide }: { slide: TvSlide }) {
  const url = slide.content?.url

  if (!url) {
    return <div className="text-gray-500 text-xl">Geen afbeelding</div>
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <img
        src={url}
        alt={slide.title || 'TV Slide'}
        className="max-w-full max-h-full object-contain rounded-lg"
      />
    </div>
  )
}
