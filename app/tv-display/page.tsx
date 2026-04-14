'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface TvSlide {
  id: string
  type: 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders'
  title: string | null
  content: any
  sort_order: number
  active: boolean
}

interface ProductionOrder {
  order_number: string
  sales_order_number: string | null
  due_date: string | null
  status: 'in_progress' | 'waiting'
  active_timers: Array<{
    employee_name: string
    production_step: string
    production_item_number: string
    elapsed_seconds: number
  }>
  lines: Array<{ item_number: string; description: string | null; quantity: number }>
}

const ROTATION_INTERVAL = 15000
const PRODUCTION_POLL_INTERVAL = 15000

export default function TvDisplayPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState('')
  const [date, setDate] = useState('')
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([])
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

  const fetchProductionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/production-status')
      const json = await res.json()
      setProductionOrders(json.orders || [])
    } catch (e) {
      console.error('Fout bij laden productie status:', e)
    }
  }, [])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  // Supabase Realtime voor handmatige slides
  useEffect(() => {
    const channel = supabase
      .channel('tv-slides-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_slides' }, () => {
        fetchSlides()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchSlides])

  // Poll productie-status
  const hasProductionSlide = slides.some(s => s.type === 'productieorders')
  useEffect(() => {
    if (!hasProductionSlide) return
    fetchProductionStatus()
    const interval = setInterval(fetchProductionStatus, PRODUCTION_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [hasProductionSlide, fetchProductionStatus])

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
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ backgroundColor: '#003d2e' }}>
      <div className="flex items-center justify-between px-8 py-3 shrink-0" style={{ backgroundColor: '#002b20', borderBottom: '2px solid #00664d' }}>
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#4ade80' }} />
          <span className="text-xl font-bold tracking-widest text-white">FORESCO</span>
          <span className="text-sm font-medium tracking-wide" style={{ color: '#80bfaa' }}>PRODUCTIE DISPLAY</span>
        </div>
        {slides.length > 1 && (
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full transition-colors" style={{ backgroundColor: i === currentIndex ? '#4ade80' : '#1a5c47' }} />
            ))}
          </div>
        )}
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-white">{clock}</div>
          <div className="text-sm capitalize" style={{ color: '#80bfaa' }}>{date}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        {!currentSlide ? (
          <div className="text-2xl" style={{ color: '#4a8a74' }}>Geen actieve slides</div>
        ) : currentSlide.type === 'werkorders' ? (
          <WerkordersSlide slide={currentSlide} />
        ) : currentSlide.type === 'tekst' ? (
          <TekstSlide slide={currentSlide} />
        ) : currentSlide.type === 'afbeelding' ? (
          <AfbeeldingSlide slide={currentSlide} />
        ) : currentSlide.type === 'productieorders' ? (
          <ProductieordersSlide orders={productionOrders} title={currentSlide.title} />
        ) : null}
      </div>
    </div>
  )
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}u ${m}m`
  return `${m}m`
}

function ProductieordersSlide({ orders, title }: { orders: ProductionOrder[]; title: string | null }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-5xl font-bold text-white">{title || 'Productieorders'}</div>
        <div className="text-2xl" style={{ color: '#80bfaa' }}>Momenteel geen openstaande productieorders</div>
        <div className="text-sm mt-2" style={{ color: '#4a8a74' }}>
          Upload een order via /admin/production-order-upload om hier te verschijnen
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 overflow-auto">
      <h2 className="text-3xl font-bold text-center mb-6 text-white">
        {title || 'Productieorders'}
      </h2>
      <div className="flex-1 space-y-4">
        {orders.map((order) => (
          <div
            key={order.order_number}
            className="rounded-xl px-6 py-4"
            style={{
              backgroundColor: order.status === 'in_progress' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: order.status === 'in_progress' ? '2px solid #4ade80' : '1px solid #1a5c47',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <span
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: order.status === 'in_progress' ? '#166534' : '#1a5c47',
                    color: order.status === 'in_progress' ? '#4ade80' : '#80bfaa',
                  }}
                >
                  {order.status === 'in_progress' ? 'ACTIEF' : 'WACHTEND'}
                </span>
                <span className="text-2xl font-bold text-white">{order.order_number}</span>
                {order.sales_order_number && (
                  <span className="text-lg" style={{ color: '#80bfaa' }}>({order.sales_order_number})</span>
                )}
              </div>
              {order.due_date && (
                <span className="text-sm" style={{ color: '#80bfaa' }}>
                  Deadline: {new Date(order.due_date).toLocaleDateString('nl-NL')}
                </span>
              )}
            </div>

            {/* Actieve timers */}
            {order.active_timers.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {order.active_timers.map((timer, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)' }}
                  >
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#4ade80' }} />
                    <span className="text-sm font-semibold text-white">{timer.employee_name}</span>
                    <span className="text-sm" style={{ color: '#80bfaa' }}>—</span>
                    <span className="text-sm" style={{ color: '#80bfaa' }}>{timer.production_step}</span>
                    <span className="text-sm font-mono" style={{ color: '#4ade80' }}>{formatElapsed(timer.elapsed_seconds)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Order lijnen (compact) */}
            {order.lines.length > 0 && order.status === 'in_progress' && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                {order.lines.slice(0, 5).map((line, i) => (
                  <span key={i} className="text-sm" style={{ color: '#a0c4b8' }}>
                    {line.quantity}x {line.item_number} {line.description ? `— ${line.description}` : ''}
                  </span>
                ))}
                {order.lines.length > 5 && (
                  <span className="text-sm" style={{ color: '#4a8a74' }}>+{order.lines.length - 5} meer</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WerkordersSlide({ slide }: { slide: TvSlide }) {
  const lines: string[] = (slide.content?.lines || []).filter((l: string) => l.trim())

  if (lines.length === 0) {
    return <div className="text-xl" style={{ color: '#4a8a74' }}>Geen werkorders ingevoerd</div>
  }

  return (
    <div className="w-full h-full flex flex-col px-10 py-6">
      {slide.title && (
        <h2 className="text-4xl font-bold text-center mb-6 text-white">{slide.title}</h2>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '3px solid #00664d' }}>
              <th className="text-left py-4 px-6 text-xl font-bold w-20" style={{ color: '#4ade80' }}>#</th>
              <th className="text-left py-4 px-6 text-xl font-bold" style={{ color: '#4ade80' }}>Werkorder</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1a5c47', backgroundColor: i === 0 ? 'rgba(74, 222, 128, 0.1)' : 'transparent' }}>
                <td className="py-5 px-6 font-mono text-2xl" style={{ color: '#4a8a74' }}>{i + 1}</td>
                <td className={`py-5 px-6 ${i === 0 ? 'text-3xl font-bold' : 'text-2xl'}`} style={{ color: i === 0 ? '#4ade80' : '#e0f0ea' }}>{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TekstSlide({ slide }: { slide: TvSlide }) {
  const text = slide.content?.text || ''
  const fontSize = slide.content?.fontSize || 'large'
  const sizeClass = fontSize === 'xlarge' ? 'text-8xl' : fontSize === 'large' ? 'text-6xl' : 'text-4xl'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-16">
      {slide.title && <h2 className="text-4xl font-bold mb-10" style={{ color: '#4ade80' }}>{slide.title}</h2>}
      <p className={`${sizeClass} font-bold leading-snug whitespace-pre-wrap text-center text-white`}>
        {text || <span style={{ color: '#4a8a74' }}>Geen tekst</span>}
      </p>
    </div>
  )
}

function AfbeeldingSlide({ slide }: { slide: TvSlide }) {
  const url = slide.content?.url
  if (!url) return <div className="text-xl" style={{ color: '#4a8a74' }}>Geen afbeelding</div>

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={slide.title || 'TV Slide'} className="max-w-full max-h-full object-contain" />
    </div>
  )
}
