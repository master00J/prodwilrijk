'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { DEFAULT_SITE } from '@/lib/sites'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SlideType = 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders' | 'inpakstatistiek' | 'dagplanning' | 'countdown' | 'weer' | 'priorities' | 'transportplanning'

interface TvSlide {
  id: string
  type: SlideType
  title: string | null
  content: any
  sort_order: number
  active: boolean
  duration: number | null
}

interface TvScreenInfo {
  slug: string
  name: string
  site: string
  active: boolean
  screen_group: string
  last_seen_at: string | null
}

interface ProductionOrder {
  order_number: string
  sales_order_number: string | null
  due_date: string | null
  tv_priority: number
  status: 'in_progress' | 'waiting'
  active_timers: Array<{
    employee_name: string
    production_step: string
    production_item_number: string
    item_description: string | null
    elapsed_seconds: number
  }>
  lines: Array<{ id: number; line_no: number | null; item_number: string; description: string | null; quantity: number; tv_priority: number }>
}

interface PackingStatsDaily {
  date: string
  label: string
  prepackItems: number
  airtecItems: number
  prepackManHours: number
  airtecManHours: number
  itemsTotal: number
  manHoursTotal: number
  scorePrepack: number
  scoreAirtec: number
  scoreTotal: number
}

interface WeekTotals {
  itemsPacked: number
  itemsPrepack: number
  itemsAirtec: number
  manHours: number
  manHoursPrepack: number
  manHoursAirtec: number
  scorePrepack: number
  scoreAirtec: number
  scoreTotal: number
}

interface WeekData {
  dateFrom: string
  dateTo: string
  totals: WeekTotals
  daily: PackingStatsDaily[]
}

interface PackingStatsResponse {
  dateFrom: string
  dateTo: string
  days: number
  pointRate: number
  daily: PackingStatsDaily[]
  totals: WeekTotals
  thisWeek?: WeekData
  prevWeek?: WeekData
}

interface DagplanningEntry {
  employeeName: string
  status: string
  machine: string | null
  notes: string | null
}

interface WeatherDayForecast {
  date: string
  dayName: string
  tempMax: number
  tempMin: number
  code: number
  icon: string
  label: string
  precipitation: number
  windMax: number
}

interface WeatherData {
  temperature: number
  windSpeed: number
  weatherCode: number
  weatherLabel: string
  weatherIcon: string
  weekForecast: WeatherDayForecast[]
}

interface PriorityItem {
  source: 'prepack' | 'airtec'
  id: number
  label: string
  subLabel: string | null
  quantity: number
  date: string
  problem: boolean
  measurement: boolean
}

interface PrioritiesData {
  prepack: PriorityItem[]
  airtec: PriorityItem[]
  stats: { prepackTotal: number; airtecTotal: number; prepackPrio: number; airtecPrio: number }
}

const DEFAULT_SLIDE_DURATION = 15
const PRODUCTION_POLL_INTERVAL = 15000
const PACKING_STATS_POLL_INTERVAL = 60 * 1000
const DAGPLANNING_POLL_INTERVAL = 60 * 1000
const WEATHER_POLL_INTERVAL = 15 * 60 * 1000
const PRIORITIES_POLL_INTERVAL = 30 * 1000

interface TransportDisplayEntry {
  id: string
  transport_date: string
  transport_type: 'eigen' | 'extern' | 'ophaling'
  destination: string | null
  description: string | null
  transporter_name: string | null
  notes: string | null
}

const TRANSPORT_POLL_INTERVAL = 60_000

export function TvDisplay({ screenSlug }: { screenSlug?: string }) {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [screenSite, setScreenSite] = useState(DEFAULT_SITE)
  const [screenInfo, setScreenInfo] = useState<TvScreenInfo | null>(null)
  const [connectionState, setConnectionState] = useState<'online' | 'offline'>('online')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState('')
  const [date, setDate] = useState('')
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([])
  const [packingStats, setPackingStats] = useState<PackingStatsResponse | null>(null)
  const [dagplanning, setDagplanning] = useState<DagplanningEntry[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [priorities, setPriorities] = useState<PrioritiesData | null>(null)
  const [transportEntries, setTransportEntries] = useState<TransportDisplayEntry[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSlides = useCallback(async () => {
    try {
      const url = screenSlug ? `/api/tv-screens/${screenSlug}/slides` : '/api/tv-slides'
      const res = await fetch(url)
      const json = await res.json()
      if (json.screen) {
        setScreenInfo(json.screen)
        if (json.screen.site) setScreenSite(json.screen.site)
      }
      const allSlides = json.data || []
      if (json.screen?.active === false) {
        setSlides([])
        setConnectionState('online')
        setLastRefresh(new Date())
        return
      }
      const active = screenSlug
        ? allSlides.filter((s: TvSlide) => s.active).sort((a: TvSlide, b: TvSlide) => a.sort_order - b.sort_order)
        : allSlides.filter((s: TvSlide) => s.active).sort((a: TvSlide, b: TvSlide) => a.sort_order - b.sort_order)
      setSlides(active)
      setConnectionState('online')
      setLastRefresh(new Date())
    } catch (e) {
      setConnectionState('offline')
      console.error('Fout bij laden slides:', e)
    }
  }, [screenSlug])

  const sendHeartbeat = useCallback(async () => {
    if (!screenSlug) return
    try {
      const res = await fetch(`/api/tv-screens/${screenSlug}/heartbeat`, { method: 'POST' })
      const json = await res.json()
      if (json.screen) {
        setScreenInfo(json.screen)
        if (json.screen.site) setScreenSite(json.screen.site)
      }
      setConnectionState('online')
    } catch {
      setConnectionState('offline')
    }
  }, [screenSlug])

  const fetchProductionStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/tv-slides/production-status?site=${encodeURIComponent(screenSite)}`)
      const json = await res.json()
      setProductionOrders(json.orders || [])
    } catch (e) {
      console.error('Fout bij laden productie status:', e)
    }
  }, [screenSite])

  const fetchPackingStats = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/packing-stats?days=14')
      if (!res.ok) throw new Error('packing-stats failed')
      const json = await res.json()
      setPackingStats(json)
    } catch (e) {
      console.error('Fout bij laden inpakstatistieken:', e)
      setPackingStats(null)
    }
  }, [])

  const fetchDagplanning = useCallback(async () => {
    try {
      const res = await fetch(`/api/tv-slides/dagplanning?site=${encodeURIComponent(screenSite)}`)
      if (!res.ok) throw new Error('dagplanning failed')
      const json = await res.json()
      setDagplanning(json.entries || [])
    } catch (e) {
      console.error('Fout bij laden dagplanning:', e)
    }
  }, [screenSite])

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/weather')
      if (!res.ok) throw new Error('weather failed')
      const json = await res.json()
      setWeather(json)
    } catch (e) {
      console.error('Fout bij laden weer:', e)
    }
  }, [])

  const fetchPriorities = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/priorities')
      if (!res.ok) throw new Error('priorities failed')
      const json = await res.json()
      setPriorities(json)
    } catch (e) {
      console.error('Fout bij laden prioriteiten:', e)
    }
  }, [])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  useEffect(() => {
    if (!screenSlug) return
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 30000)
    return () => clearInterval(interval)
  }, [screenSlug, sendHeartbeat])

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

  const hasPackingSlide = slides.some(s => s.type === 'inpakstatistiek')
  useEffect(() => {
    if (!hasPackingSlide) return
    fetchPackingStats()
    const interval = setInterval(fetchPackingStats, PACKING_STATS_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [hasPackingSlide, fetchPackingStats])

  const hasDagplanningSlide = slides.some(s => s.type === 'dagplanning')
  useEffect(() => {
    if (!hasDagplanningSlide) return
    fetchDagplanning()
    const interval = setInterval(fetchDagplanning, DAGPLANNING_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [hasDagplanningSlide, fetchDagplanning])

  const hasWeatherSlide = slides.some(s => s.type === 'weer')
  useEffect(() => {
    if (!hasWeatherSlide) return
    fetchWeather()
    const interval = setInterval(fetchWeather, WEATHER_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [hasWeatherSlide, fetchWeather])

  // Priorities: altijd pollen zodat de slide automatisch kan activeren/deactiveren
  useEffect(() => {
    fetchPriorities()
    const interval = setInterval(fetchPriorities, PRIORITIES_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPriorities])

  const fetchTransport = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-slides/transport-planning?weekOffset=0')
      if (!res.ok) throw new Error('transport failed')
      const json = await res.json()
      setTransportEntries(json.data || [])
    } catch (e) {
      console.error('Fout bij laden transport:', e)
    }
  }, [])

  const hasTransportSlide = slides.some(s => s.type === 'transportplanning')
  useEffect(() => {
    if (!hasTransportSlide) return
    fetchTransport()
    const interval = setInterval(fetchTransport, TRANSPORT_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [hasTransportSlide, fetchTransport])

  // Priorities slide automatisch tonen/verbergen op basis van prio items
  const hasPrioItems = (priorities?.prepack?.length ?? 0) + (priorities?.airtec?.length ?? 0) > 0
  const visibleSlides = slides.filter(s => {
    if (s.type === 'priorities') return hasPrioItems
    return true
  })

  // Auto-rotatie met dynamische duur per slide
  const slideDuration = visibleSlides.length > 0
    ? (visibleSlides[currentIndex]?.duration ?? DEFAULT_SLIDE_DURATION) * 1000
    : DEFAULT_SLIDE_DURATION * 1000

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (visibleSlides.length > 1) {
      timerRef.current = setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % visibleSlides.length)
      }, slideDuration)
    } else {
      setCurrentIndex(0)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [visibleSlides.length, currentIndex, slideDuration])

  useEffect(() => {
    if (currentIndex >= visibleSlides.length) setCurrentIndex(0)
  }, [visibleSlides.length, currentIndex])

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

  const currentSlide = visibleSlides[currentIndex] || null

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ backgroundColor: '#003d2e' }}>
      <div className="flex items-center justify-between px-8 py-3 shrink-0" style={{ backgroundColor: '#002b20', borderBottom: '2px solid #00664d' }}>
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#4ade80' }} />
          <span className="text-xl font-bold tracking-widest text-white">FORESCO</span>
          <span className="text-sm font-medium tracking-wide" style={{ color: '#80bfaa' }}>
            {screenInfo ? `${screenInfo.name} - ${screenInfo.site || DEFAULT_SITE}` : 'PRODUCTIE DISPLAY'}
          </span>
        </div>
        {visibleSlides.length > 1 && (
          <div className="flex gap-2">
            {visibleSlides.map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full transition-colors" style={{ backgroundColor: i === currentIndex ? '#4ade80' : '#1a5c47' }} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-5">
          <div className="text-right text-xs" style={{ color: '#80bfaa' }}>
            <div className="flex items-center justify-end gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: connectionState === 'online' ? '#4ade80' : '#fb7185' }} />
              {connectionState === 'online' ? 'online' : 'offline'}
            </div>
            <div>{lastRefresh ? `refresh ${lastRefresh.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'nog geen refresh'}</div>
          </div>
          <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-white">{clock}</div>
          <div className="text-sm capitalize" style={{ color: '#80bfaa' }}>{date}</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {visibleSlides.length > 1 && currentSlide && (
        <div className="h-1 shrink-0" style={{ backgroundColor: '#1a5c47' }}>
          <div
            key={`progress-${currentIndex}-${currentSlide.id}`}
            className="h-full"
            style={{
              backgroundColor: '#4ade80',
              animation: `slideProgress ${slideDuration}ms linear forwards`,
            }}
          />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center min-h-0">
        {!currentSlide ? (
          <EmptyDisplayState screen={screenInfo} screenSlug={screenSlug} />
        ) : currentSlide.type === 'werkorders' ? (
          <WerkordersSlide slide={currentSlide} />
        ) : currentSlide.type === 'tekst' ? (
          <TekstSlide slide={currentSlide} />
        ) : currentSlide.type === 'afbeelding' ? (
          <AfbeeldingSlide slide={currentSlide} />
        ) : currentSlide.type === 'productieorders' ? (
          <ProductieordersSlide orders={productionOrders} title={currentSlide.title} />
        ) : currentSlide.type === 'inpakstatistiek' ? (
          <PackingStatsSlide data={packingStats} title={currentSlide.title} />
        ) : currentSlide.type === 'dagplanning' ? (
          <DagplanningSlide entries={dagplanning} slide={currentSlide} />
        ) : currentSlide.type === 'countdown' ? (
          <CountdownSlide slide={currentSlide} />
        ) : currentSlide.type === 'weer' ? (
          <WeerSlide data={weather} title={currentSlide.title} />
        ) : currentSlide.type === 'priorities' ? (
          <PrioriteitenSlide data={priorities} title={currentSlide.title} />
        ) : currentSlide.type === 'transportplanning' ? (
          <TransportPlanningSlide entries={transportEntries} title={currentSlide.title} />
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes slideProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}u ${m}m`
  return `${m}m`
}

function EmptyDisplayState({ screen, screenSlug }: { screen: TvScreenInfo | null; screenSlug?: string }) {
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="rounded-3xl border px-10 py-8" style={{ borderColor: '#1a5c47', backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <div className="mb-3 text-sm font-bold uppercase tracking-[0.3em]" style={{ color: TV_MUTED }}>
          Narrowcasting scherm
        </div>
        <h1 className="text-5xl font-black text-white">
          {screen?.name || screenSlug || 'TV Display'}
        </h1>
        <div className="mt-3 text-xl font-semibold" style={{ color: '#4ade80' }}>
          {screen?.site || DEFAULT_SITE}{screen?.screen_group ? ` - ${screen.screen_group}` : ''}
        </div>
        {screen?.active === false ? (
          <p className="mt-6 text-2xl font-semibold" style={{ color: '#fbbf24' }}>
            Dit scherm is tijdelijk gepauzeerd.
          </p>
        ) : (
          <>
            <p className="mt-6 text-2xl font-semibold" style={{ color: TV_MUTED }}>
              Geen slides gekoppeld of actief.
            </p>
            <p className="mt-2 text-lg" style={{ color: '#4a8a74' }}>
              Koppel slides via TV-admin om dit scherm te activeren.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function BarLabel(props: any) {
  const { x, y, width, value, fill, fontSize } = props
  if (!value || value === 0) return null
  return (
    <text x={x + width / 2} y={y - 4} fill={fill} fontSize={fontSize} textAnchor="middle">
      {value}
    </text>
  )
}

const TV_MUTED = '#80bfaa'
const TV_GRID = '#1a5c47'
const TV_TICK = '#a0c4b8'

function DiffBadge({ current, previous, suffix, invert }: { current: number; previous: number; suffix?: string; invert?: boolean }) {
  if (previous === 0) return null
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff === 0) return <span className="text-xs font-semibold ml-1" style={{ color: TV_MUTED }}>= 0%</span>
  const isPositive = invert ? diff < 0 : diff > 0
  const color = isPositive ? '#4ade80' : '#fb7185'
  const arrow = diff > 0 ? '▲' : '▼'
  return (
    <span className="text-xs font-bold ml-1.5" style={{ color }}>
      {arrow} {Math.abs(diff).toLocaleString('nl-NL')}{suffix || ''} ({pct > 0 ? '+' : ''}{pct}%)
    </span>
  )
}

function WeekKpiCards({ totals, prevTotals, label }: { totals: WeekTotals; prevTotals?: WeekTotals; label: string }) {
  const prev = prevTotals || null
  const hasScores = (totals.scoreTotal ?? 0) !== 0 || (prev && (prev.scoreTotal ?? 0) !== 0)
  return (
    <div className={`grid gap-3 shrink-0 ${hasScores ? 'grid-cols-5' : 'grid-cols-4'}`}>
      <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(74, 222, 128, 0.12)', border: '1px solid #22c55e' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: TV_MUTED }}>Totaal verpakt</div>
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-white tabular-nums">{totals.itemsPacked.toLocaleString('nl-NL')}</span>
          {prev && <DiffBadge current={totals.itemsPacked} previous={prev.itemsPacked} />}
        </div>
        <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
          {totals.manHours.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} manuren
          {prev && <DiffBadge current={totals.manHours} previous={prev.manHours} suffix="u" />}
        </div>
      </div>

      <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#93c5fd' }}>Prepack</div>
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-white tabular-nums">{totals.itemsPrepack.toLocaleString('nl-NL')}</span>
          {prev && <DiffBadge current={totals.itemsPrepack} previous={prev.itemsPrepack} />}
        </div>
        <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
          {totals.manHoursPrepack.toFixed(1)} manuren
          {hasScores && <> &middot; Score: {(totals.scorePrepack ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}</>}
        </div>
      </div>

      <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#c4b5fd' }}>Airtec</div>
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-white tabular-nums">{totals.itemsAirtec.toLocaleString('nl-NL')}</span>
          {prev && <DiffBadge current={totals.itemsAirtec} previous={prev.itemsAirtec} />}
        </div>
        <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
          {totals.manHoursAirtec.toFixed(1)} manuren
          {hasScores && <> &middot; Score: {(totals.scoreAirtec ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}</>}
        </div>
      </div>

      {hasScores && (
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(250, 204, 21, 0.12)', border: '1px solid #eab308' }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#fde047' }}>Score</div>
          <div className="flex items-baseline">
            <span className="text-4xl font-bold text-white tabular-nums">{(totals.scoreTotal ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}</span>
            {prev && <DiffBadge current={totals.scoreTotal ?? 0} previous={prev.scoreTotal ?? 0} suffix=" pt" />}
          </div>
          <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
            PP: {(totals.scorePrepack ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} &middot; AT: {(totals.scoreAirtec ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}
          </div>
        </div>
      )}

      <div className="rounded-xl px-5 py-4 flex flex-col justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid #1a5c47' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: TV_MUTED }}>{label}</div>
        {prev ? (
          <div>
            <div className="text-sm text-white mb-1">
              Stuks: <DiffBadge current={totals.itemsPacked} previous={prev.itemsPacked} />
            </div>
            <div className="text-sm text-white mb-1">
              Uren: <DiffBadge current={totals.manHours} previous={prev.manHours} suffix="u" />
            </div>
            {hasScores && (
              <div className="text-sm text-white">
                Score: <DiffBadge current={totals.scoreTotal ?? 0} previous={prev.scoreTotal ?? 0} suffix=" pt" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm" style={{ color: TV_MUTED }}>Geen vergelijking</div>
        )}
      </div>
    </div>
  )
}

function PackingStatsSlide({
  data,
  title,
}: {
  data: PackingStatsResponse | null
  title: string | null
}) {
  const [tab, setTab] = useState<'week' | 'vorige' | 'trend'>('week')

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-bold text-white">{title || 'Prepack + Airtec'}</div>
        <div className="text-xl" style={{ color: TV_MUTED }}>Statistieken laden…</div>
      </div>
    )
  }

  const thisWeek = data.thisWeek
  const prevWeek = data.prevWeek
  const fmtPeriod = (from: string, to: string) =>
    `${new Date(from).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — ${new Date(to).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`

  const tabs = [
    { id: 'week' as const, label: 'Deze week' },
    { id: 'vorige' as const, label: 'Vorige week' },
    { id: 'trend' as const, label: 'Trend (14d)' },
  ]

  const activeTotals = tab === 'week' ? thisWeek?.totals : tab === 'vorige' ? prevWeek?.totals : data.totals
  const activeDaily = tab === 'week' ? (thisWeek?.daily || []) : tab === 'vorige' ? (prevWeek?.daily || []) : data.daily
  const compareTotals = tab === 'week' ? prevWeek?.totals : undefined
  const periodLabel = tab === 'week' && thisWeek
    ? fmtPeriod(thisWeek.dateFrom, thisWeek.dateTo)
    : tab === 'vorige' && prevWeek
    ? fmtPeriod(prevWeek.dateFrom, prevWeek.dateTo)
    : fmtPeriod(data.dateFrom, data.dateTo)

  return (
    <div className="w-full h-full flex flex-col px-8 py-5 min-h-0 overflow-hidden">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <h2 className="text-3xl font-bold text-white">{title || 'Inpak Statistieken'}</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1a5c47' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: tab === t.id ? '#4ade80' : 'transparent',
                  color: tab === t.id ? '#002b20' : TV_MUTED,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-sm" style={{ color: TV_MUTED }}>{periodLabel}</span>
        </div>
      </div>

      {/* KPI cards */}
      {activeTotals && (
        <div className="shrink-0 mb-4">
          <WeekKpiCards
            totals={activeTotals}
            prevTotals={compareTotals}
            label={tab === 'week' ? 'vs vorige week' : tab === 'vorige' ? 'Vorige week' : 'Periode totaal'}
          />
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-[180px] w-full rounded-xl px-2 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        {activeDaily.length === 0 ? (
          <p className="text-center text-lg pt-8" style={{ color: TV_MUTED }}>Geen data in deze periode.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={activeDaily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={TV_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: TV_TICK, fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={48} axisLine={{ stroke: TV_GRID }} tickLine={false} />
              <YAxis yAxisId="items" tick={{ fill: TV_TICK, fontSize: 11 }} axisLine={false} tickLine={false} width={50} label={{ value: 'Stuks', angle: -90, position: 'insideLeft', offset: 10, style: { fill: TV_MUTED, fontSize: 11 } }} />
              <YAxis yAxisId="uur" orientation="right" tick={{ fill: TV_TICK, fontSize: 11 }} axisLine={false} tickLine={false} width={50} label={{ value: 'Uren / Score', angle: 90, position: 'insideRight', offset: 10, style: { fill: TV_MUTED, fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#002b20', border: '1px solid #00664d', borderRadius: 8, color: '#fff', fontSize: 13 }}
                labelStyle={{ color: TV_MUTED, fontWeight: 600 }}
                formatter={(value: any, name: any) => {
                  const numericValue = Number(value ?? 0)
                  const label = String(name ?? '')
                  if (label.includes('uren')) return [`${numericValue.toFixed(1)} u`, label]
                  if (label.includes('Score')) return [`${numericValue.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} pt`, label]
                  return [numericValue.toLocaleString('nl-NL') + ' stuks', label]
                }}
              />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} iconType="circle" iconSize={8} />
              <Bar yAxisId="items" dataKey="prepackItems" name="Prepack" fill="#3b82f6" radius={[3, 3, 0, 0]} label={<BarLabel fill="#93c5fd" fontSize={activeDaily.length > 10 ? 11 : 14} />} />
              <Bar yAxisId="items" dataKey="airtecItems" name="Airtec" fill="#a855f7" radius={[3, 3, 0, 0]} label={<BarLabel fill="#c4b5fd" fontSize={activeDaily.length > 10 ? 11 : 14} />} />
              <Line yAxisId="uur" type="monotone" dataKey="manHoursTotal" name="Manuren totaal" stroke="#facc15" strokeWidth={3} dot={{ r: 3, fill: '#facc15', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              <Line yAxisId="uur" type="monotone" dataKey="scoreTotal" name="Score totaal" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
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
        {orders.map((order) => {
          const rank = order.tv_priority || 0
          const hasRank = rank > 0
          const isTop = rank === 1

          const borderColor = isTop ? '#facc15' : hasRank ? '#f97316' : order.status === 'in_progress' ? '#4ade80' : '#1a5c47'
          const bgColor = isTop ? 'rgba(250, 204, 21, 0.12)' : hasRank ? 'rgba(249, 115, 22, 0.08)' : order.status === 'in_progress' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.04)'

          return (
          <div
            key={order.order_number}
            className="rounded-xl px-6 py-4"
            style={{
              backgroundColor: bgColor,
              border: `2px solid ${borderColor}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                {hasRank && (
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${isTop ? 'animate-pulse' : ''}`}
                    style={{
                      backgroundColor: isTop ? '#facc15' : rank <= 3 ? '#f97316' : '#6b7280',
                      color: isTop ? '#422006' : '#fff',
                    }}
                  >
                    {rank}
                  </span>
                )}
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

            {/* Items tabel */}
            {order.lines.length > 0 && (
              <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid #1a5c47' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: '#80bfaa' }}>Item</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: '#80bfaa' }}>Omschrijving</th>
                      <th className="text-right px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: '#80bfaa' }}>Aantal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line, i) => (
                      <tr key={line.id || i} style={{ borderTop: '1px solid #1a5c4750' }}>
                        <td className="px-4 py-2 font-mono font-bold text-white">
                          <span className="inline-flex items-center gap-2">
                            {(line.tv_priority || 0) > 0 && (
                              <span className="rounded-full px-2 py-0.5 text-xs font-black" style={{ backgroundColor: '#facc15', color: '#422006' }}>
                                #{line.tv_priority}
                              </span>
                            )}
                            <BcItemCode value={line.item_number} />
                          </span>
                        </td>
                        <td className="px-4 py-2" style={{ color: '#a0c4b8' }}>{line.description || '—'}</td>
                        <td className="px-4 py-2 text-right font-bold text-white">{line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
                    <span className="text-sm font-mono" style={{ color: '#80bfaa' }}>
                      <BcItemCode value={timer.production_item_number} />
                    </span>
                    {timer.item_description && (
                      <span className="text-xs" style={{ color: '#4a8a74' }}>({timer.item_description})</span>
                    )}
                    <span className="text-sm" style={{ color: '#80bfaa' }}>—</span>
                    <span className="text-sm" style={{ color: '#80bfaa' }}>{timer.production_step}</span>
                    <span className="text-sm font-mono" style={{ color: '#4ade80' }}>{formatElapsed(timer.elapsed_seconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        })}
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

/* ---------- Dagplanning ---------- */

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  aanwezig: { label: 'Aanwezig', bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  thuiswerk: { label: 'Thuiswerk', bg: 'rgba(56, 189, 248, 0.12)', text: '#38bdf8' },
  verlof: { label: 'Verlof', bg: 'rgba(250, 204, 21, 0.12)', text: '#facc15' },
  ziek: { label: 'Ziek', bg: 'rgba(251, 113, 133, 0.12)', text: '#fb7185' },
  afwezig: { label: 'Afwezig', bg: 'rgba(255,255,255,0.05)', text: '#6b7280' },
}

function DagplanningSlide({ entries, slide }: { entries: DagplanningEntry[]; slide: TvSlide }) {
  const manualLines: string[] = slide.content?.manualEntries || []
  const useManual = manualLines.length > 0

  const present = entries.filter(e => e.status === 'aanwezig' || e.status === 'thuiswerk')
  const absent = entries.filter(e => e.status !== 'aanwezig' && e.status !== 'thuiswerk')

  const cols = present.length > 16 ? 4 : present.length > 8 ? 3 : 2
  const isCompact = present.length > 12
  const today = new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="w-full h-full flex flex-col px-10 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <h2 className="text-3xl font-bold text-white">{slide.title || 'Dagplanning'}</h2>
        <div className="flex items-center gap-6">
          <span className="text-sm capitalize" style={{ color: TV_MUTED }}>{today}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
              <span className="text-sm font-semibold text-white">{present.length}</span>
              <span className="text-xs" style={{ color: TV_MUTED }}>aanwezig</span>
            </span>
            {absent.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f87171' }} />
                <span className="text-sm font-semibold text-white">{absent.length}</span>
                <span className="text-xs" style={{ color: TV_MUTED }}>afwezig</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {useManual ? (
        <div className="flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-2">
            {manualLines.map((line, i) => (
              <div key={i} className="px-5 py-3 rounded-lg text-lg text-white" style={{ borderBottom: '1px solid #1a5c47' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xl" style={{ color: TV_MUTED }}>Geen dagplanning ingevuld voor vandaag</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Aanwezig grid */}
          <div className="flex-1 min-h-0">
            <div
              className="grid gap-2 h-full"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridAutoRows: '1fr',
              }}
            >
              {present.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-lg flex items-center gap-3 min-h-0"
                  style={{
                    backgroundColor: entry.status === 'thuiswerk' ? 'rgba(56, 189, 248, 0.10)' : 'rgba(74, 222, 128, 0.08)',
                    border: `1px solid ${entry.status === 'thuiswerk' ? '#38bdf830' : '#4ade8025'}`,
                    padding: isCompact ? '0.35rem 0.75rem' : '0.5rem 1rem',
                  }}
                >
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center font-bold text-white"
                    style={{
                      width: isCompact ? '2rem' : '2.5rem',
                      height: isCompact ? '2rem' : '2.5rem',
                      fontSize: isCompact ? '0.75rem' : '0.875rem',
                      backgroundColor: entry.status === 'thuiswerk' ? '#0ea5e9' : '#16a34a',
                    }}
                  >
                    {entry.employeeName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-white truncate"
                      style={{ fontSize: isCompact ? '0.85rem' : '1.05rem' }}
                    >
                      {entry.employeeName}
                    </div>
                    {entry.machine && (
                      <div
                        className="truncate"
                        style={{ color: TV_TICK, fontSize: isCompact ? '0.65rem' : '0.75rem' }}
                      >
                        {entry.machine}
                      </div>
                    )}
                  </div>
                  {entry.status === 'thuiswerk' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#0ea5e920', color: '#38bdf8' }}>
                      TW
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Afwezig strip */}
          {absent.length > 0 && (
            <div className="shrink-0 mt-3 pt-3" style={{ borderTop: '1px solid #1a5c47' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: TV_MUTED }}>Afwezig</span>
                {absent.map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.afwezig
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                      style={{ backgroundColor: `${cfg.text}15`, border: `1px solid ${cfg.text}30` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.text }} />
                      <span className="text-sm text-white">{entry.employeeName}</span>
                      <span className="text-[10px] font-semibold" style={{ color: cfg.text }}>{cfg.label}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Countdown ---------- */

function CountdownSlide({ slide }: { slide: TvSlide }) {
  const targetDate = slide.content?.targetDate
  const description = slide.content?.description || ''
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!targetDate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-bold text-white">{slide.title || 'Countdown'}</div>
        <div className="text-xl" style={{ color: TV_MUTED }}>Geen doeldatum ingesteld</div>
      </div>
    )
  }

  const target = new Date(targetDate).getTime()
  const diff = target - now
  const passed = diff < 0
  const absDiff = Math.abs(diff)

  const days = Math.floor(absDiff / 86400000)
  const hours = Math.floor((absDiff % 86400000) / 3600000)
  const minutes = Math.floor((absDiff % 3600000) / 60000)
  const seconds = Math.floor((absDiff % 60000) / 1000)

  const unitStyle = { color: TV_MUTED }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-16 gap-6">
      {slide.title && (
        <h2 className="text-3xl font-bold" style={{ color: '#4ade80' }}>{slide.title}</h2>
      )}
      {description && (
        <p className="text-xl" style={{ color: TV_MUTED }}>{description}</p>
      )}

      {passed ? (
        <div className="text-center">
          <div className="text-2xl mb-4" style={{ color: '#fb7185' }}>Verlopen</div>
          <div className="flex gap-8 items-end">
            {days > 0 && <div className="text-center"><div className="text-7xl font-bold tabular-nums text-white">{days}</div><div className="text-sm mt-1" style={unitStyle}>dagen</div></div>}
            <div className="text-center"><div className="text-7xl font-bold tabular-nums text-white">{hours}</div><div className="text-sm mt-1" style={unitStyle}>uur</div></div>
            <div className="text-center"><div className="text-7xl font-bold tabular-nums text-white">{minutes}</div><div className="text-sm mt-1" style={unitStyle}>min</div></div>
            <div className="text-center"><div className="text-5xl font-bold tabular-nums" style={{ color: TV_TICK }}>{seconds}</div><div className="text-sm mt-1" style={unitStyle}>sec</div></div>
          </div>
          <div className="text-lg mt-4" style={{ color: '#fb7185' }}>geleden</div>
        </div>
      ) : (
        <div className="flex gap-8 items-end">
          {days > 0 && <div className="text-center"><div className="text-8xl font-bold tabular-nums text-white">{days}</div><div className="text-lg mt-2" style={unitStyle}>dagen</div></div>}
          <div className="text-center"><div className="text-8xl font-bold tabular-nums text-white">{String(hours).padStart(2, '0')}</div><div className="text-lg mt-2" style={unitStyle}>uur</div></div>
          <div className="text-center"><div className="text-8xl font-bold tabular-nums text-white">{String(minutes).padStart(2, '0')}</div><div className="text-lg mt-2" style={unitStyle}>min</div></div>
          <div className="text-center"><div className="text-6xl font-bold tabular-nums" style={{ color: '#4ade80' }}>{String(seconds).padStart(2, '0')}</div><div className="text-lg mt-2" style={unitStyle}>sec</div></div>
        </div>
      )}
    </div>
  )
}

/* ---------- Weer ---------- */

function WeerSlide({ data, title }: { data: WeatherData | null; title: string | null }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-bold text-white">{title || 'Weer'}</div>
        <div className="text-xl" style={{ color: TV_MUTED }}>Weerdata laden...</div>
      </div>
    )
  }

  const today = data.weekForecast[0]
  const restOfWeek = data.weekForecast.slice(1)

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 overflow-hidden">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h2 className="text-3xl font-bold text-white">{title || 'Weer'}</h2>
        <span className="text-sm" style={{ color: TV_MUTED }}>7-daagse voorspelling</span>
      </div>

      {/* Vandaag groot */}
      <div className="flex items-center gap-8 shrink-0 mb-6 rounded-2xl px-8 py-6" style={{ backgroundColor: 'rgba(74, 222, 128, 0.08)', border: '1px solid #22c55e40' }}>
        <div className="text-[100px] leading-none">{data.weatherIcon}</div>
        <div>
          <div className="text-lg font-medium mb-1" style={{ color: TV_MUTED }}>Nu</div>
          <div className="text-7xl font-bold text-white tabular-nums">{Math.round(data.temperature)}°C</div>
          <div className="text-xl mt-1" style={{ color: TV_MUTED }}>{data.weatherLabel}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-lg" style={{ color: TV_TICK }}>Wind: {Math.round(data.windSpeed)} km/u</div>
          {today && (
            <>
              <div className="text-lg mt-1" style={{ color: TV_TICK }}>Max: {Math.round(today.tempMax)}° / Min: {Math.round(today.tempMin)}°</div>
              {today.precipitation > 0 && (
                <div className="text-lg mt-1" style={{ color: '#38bdf8' }}>Neerslag: {today.precipitation.toFixed(1)} mm</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Weekoverzicht */}
      {restOfWeek.length > 0 && (
        <div className="grid grid-cols-6 gap-3 flex-1 min-h-0">
          {restOfWeek.map((day) => (
            <div
              key={day.date}
              className="rounded-xl flex flex-col items-center justify-center py-4 px-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid #1a5c47' }}
            >
              <div className="text-sm font-bold mb-2 uppercase tracking-wide" style={{ color: TV_MUTED }}>{day.dayName}</div>
              <div className="text-5xl mb-3">{day.icon}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tabular-nums">{Math.round(day.tempMax)}°</span>
                <span className="text-lg" style={{ color: TV_TICK }}>/</span>
                <span className="text-lg tabular-nums" style={{ color: TV_TICK }}>{Math.round(day.tempMin)}°</span>
              </div>
              {day.precipitation > 0 && (
                <div className="text-xs mt-2" style={{ color: '#38bdf8' }}>{day.precipitation.toFixed(1)} mm</div>
              )}
              <div className="text-xs mt-1" style={{ color: TV_TICK }}>{Math.round(day.windMax)} km/u</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Prioriteiten ---------- */

function PrioriteitenSlide({ data, title }: { data: PrioritiesData | null; title: string | null }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-bold text-white">{title || 'Prioriteiten'}</div>
        <div className="text-xl" style={{ color: TV_MUTED }}>Prioriteiten laden…</div>
      </div>
    )
  }

  const { prepack, airtec, stats } = data
  const allItems = [...prepack, ...airtec]
  const totalPrio = stats.prepackPrio + stats.airtecPrio

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
    } catch { return '' }
  }

  const rowCount = allItems.length
  const fontSize = rowCount <= 5 ? 'text-xl' : rowCount <= 10 ? 'text-base' : rowCount <= 20 ? 'text-sm' : 'text-xs'
  const subFontSize = rowCount <= 5 ? 'text-sm' : rowCount <= 10 ? 'text-xs' : 'text-[10px]'
  const badgeSize = rowCount <= 10 ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
  const qtySize = rowCount <= 5 ? 'text-xl' : rowCount <= 10 ? 'text-base' : rowCount <= 20 ? 'text-sm' : 'text-xs'
  const headerSize = rowCount <= 10 ? 'text-xs' : 'text-[10px]'

  return (
    <div className="w-full h-full flex flex-col px-10 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <h2 className="text-3xl font-bold text-white">{title || '⭐ Prioriteiten'}</h2>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(250, 204, 21, 0.12)', border: '1px solid #ca8a0440' }}>
            <span className="text-lg font-bold text-white">{totalPrio}</span>
            <span className="text-xs" style={{ color: '#facc15' }}>prio</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
              <span className="text-sm text-white font-semibold">{stats.prepackPrio}</span>
              <span className="text-xs" style={{ color: TV_MUTED }}>Prepack ({stats.prepackTotal} open)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#c084fc' }} />
              <span className="text-sm text-white font-semibold">{stats.airtecPrio}</span>
              <span className="text-xs" style={{ color: TV_MUTED }}>Airtec ({stats.airtecTotal} open)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {allItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl">✅</div>
          <div className="text-2xl font-semibold text-white">Geen prioriteiten</div>
          <div className="text-lg" style={{ color: TV_MUTED }}>
            {stats.prepackTotal + stats.airtecTotal} items open · geen met prio-vlag
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Table */}
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '6%' }} />
              <col />
              <col style={{ width: '22%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid #1a5c47' }}>
                <th className={`text-left font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>#</th>
                <th className={`text-left font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>Bron</th>
                <th className={`text-left font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>Item</th>
                <th className={`text-left font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>Info</th>
                <th className={`text-right font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>Aantal</th>
                <th className={`text-right font-semibold uppercase tracking-wider pb-2 ${headerSize}`} style={{ color: TV_MUTED }}>Datum</th>
              </tr>
            </thead>
          </table>

          {/* Scrollable body fills remaining space */}
          <div className="flex-1 min-h-0">
            <table className="w-full h-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '6%' }} />
                <col />
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <tbody>
                {allItems.map((item, idx) => {
                  const isPrepack = item.source === 'prepack'
                  const accentColor = isPrepack ? '#60a5fa' : '#c084fc'
                  const rowHeight = `${100 / rowCount}%`
                  return (
                    <tr
                      key={`${item.source}-${item.id}`}
                      style={{
                        height: rowHeight,
                        borderBottom: '1px solid #1a5c4750',
                        backgroundColor: item.problem ? 'rgba(251, 113, 133, 0.06)' : idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <td className={`${subFontSize} tabular-nums font-medium`} style={{ color: TV_MUTED }}>
                        {idx + 1}
                      </td>
                      <td>
                        <span
                          className={`${badgeSize} font-bold rounded-full inline-block text-center`}
                          style={{ backgroundColor: `${accentColor}20`, color: accentColor, minWidth: '2rem' }}
                        >
                          {isPrepack ? 'PP' : 'AT'}
                        </span>
                      </td>
                      <td className="pr-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`${fontSize} font-semibold text-white truncate`}>{item.label}</span>
                          {item.problem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: '#fb718520', color: '#fb7185' }}>PROBLEEM</span>
                          )}
                          {item.measurement && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: '#38bdf820', color: '#38bdf8' }}>METING</span>
                          )}
                        </div>
                      </td>
                      <td className={`${subFontSize} truncate`} style={{ color: TV_TICK }}>
                        {item.subLabel || '—'}
                      </td>
                      <td className={`${qtySize} font-bold text-white tabular-nums text-right`}>
                        {item.quantity}×
                      </td>
                      <td className={`${subFontSize} text-right tabular-nums`} style={{ color: TV_MUTED }}>
                        {formatDate(item.date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const TRANSPORT_TYPE_CONFIG = {
  eigen: { label: 'Eigen transport', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: '#22c55e' },
  extern: { label: 'Externe transporteur', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: '#3b82f6' },
  ophaling: { label: 'Ophaling door klant', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: '#f97316' },
} as const

function TransportPlanningSlide({ entries, title }: { entries: TransportDisplayEntry[]; title: string | null }) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOff)

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const todayStr = now.toISOString().split('T')[0]
  const dayLabels = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']

  return (
    <div className="w-full h-full flex flex-col px-6 py-4 min-h-0 overflow-hidden">
      <h2 className="text-3xl font-bold text-white text-center mb-4 shrink-0">
        {title || 'Planning'}
      </h2>

      <div className="flex-1 grid grid-cols-5 gap-3 min-h-0">
        {weekDays.map((date, i) => {
          const dayEntries = entries.filter(e => e.transport_date === date)
          const isToday = date === todayStr
          const dayDate = new Date(date + 'T12:00:00')

          return (
            <div
              key={date}
              className="flex flex-col rounded-xl overflow-hidden min-h-0"
              style={{
                backgroundColor: isToday ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: isToday ? '2px solid #22c55e' : '1px solid #1a5c47',
              }}
            >
              {/* Dag header */}
              <div
                className="px-3 py-2.5 shrink-0 text-center"
                style={{ backgroundColor: isToday ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)' }}
              >
                <div className="text-sm font-bold" style={{ color: isToday ? '#4ade80' : '#a0c4b8' }}>
                  {dayLabels[i]}
                </div>
                <div className="text-xs" style={{ color: isToday ? '#80bfaa' : '#4a8a74' }}>
                  {dayDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </div>
                {isToday && (
                  <div className="mt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#22c55e', color: '#002b20' }}>
                      VANDAAG
                    </span>
                  </div>
                )}
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {dayEntries.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs italic" style={{ color: '#4a8a74' }}>Geen transport</span>
                  </div>
                ) : (
                  dayEntries.map(entry => {
                    const cfg = TRANSPORT_TYPE_CONFIG[entry.transport_type] || TRANSPORT_TYPE_CONFIG.eigen
                    return (
                      <div
                        key={entry.id}
                        className="rounded-lg p-2.5"
                        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}40` }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${cfg.color}30`, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        {entry.destination && (
                          <div className="text-sm font-semibold text-white truncate">{entry.destination}</div>
                        )}
                        {entry.description && (
                          <div className="text-xs truncate" style={{ color: '#a0c4b8' }}>{entry.description}</div>
                        )}
                        {entry.transporter_name && (
                          <div className="text-xs mt-1 truncate" style={{ color: '#80bfaa' }}>{entry.transporter_name}</div>
                        )}
                        {entry.notes && (
                          <div className="text-[10px] mt-1 italic truncate" style={{ color: '#4a8a74' }}>{entry.notes}</div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

