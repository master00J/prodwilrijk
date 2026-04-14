'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
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

type SlideType = 'werkorders' | 'tekst' | 'afbeelding' | 'productieorders' | 'inpakstatistiek' | 'dagplanning' | 'countdown' | 'weer'

interface TvSlide {
  id: string
  type: SlideType
  title: string | null
  content: any
  sort_order: number
  active: boolean
  duration: number | null
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

interface PackingStatsDaily {
  date: string
  label: string
  prepackItems: number
  airtecItems: number
  prepackManHours: number
  airtecManHours: number
  itemsTotal: number
  manHoursTotal: number
}

interface PackingStatsResponse {
  dateFrom: string
  dateTo: string
  days: number
  daily: PackingStatsDaily[]
  totals: {
    itemsPacked: number
    itemsPrepack: number
    itemsAirtec: number
    manHours: number
    manHoursPrepack: number
    manHoursAirtec: number
  }
}

interface DagplanningEntry {
  employeeName: string
  status: string
  machine: string | null
  notes: string | null
}

interface WeatherData {
  temperature: number
  windSpeed: number
  weatherCode: number
  weatherLabel: string
  weatherIcon: string
  forecast: Array<{
    time: string
    label: string
    temp: number
    code: number
    icon: string
  }>
}

const DEFAULT_SLIDE_DURATION = 15
const PRODUCTION_POLL_INTERVAL = 15000
const PACKING_STATS_POLL_INTERVAL = 60 * 1000
const DAGPLANNING_POLL_INTERVAL = 5 * 60 * 1000
const WEATHER_POLL_INTERVAL = 15 * 60 * 1000

export default function TvDisplayPage() {
  const [slides, setSlides] = useState<TvSlide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [clock, setClock] = useState('')
  const [date, setDate] = useState('')
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([])
  const [packingStats, setPackingStats] = useState<PackingStatsResponse | null>(null)
  const [dagplanning, setDagplanning] = useState<DagplanningEntry[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
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
      const res = await fetch('/api/tv-slides/dagplanning')
      if (!res.ok) throw new Error('dagplanning failed')
      const json = await res.json()
      setDagplanning(json.entries || [])
    } catch (e) {
      console.error('Fout bij laden dagplanning:', e)
    }
  }, [])

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

  // Auto-rotatie met dynamische duur per slide
  const slideDuration = slides.length > 0
    ? (slides[currentIndex]?.duration ?? DEFAULT_SLIDE_DURATION) * 1000
    : DEFAULT_SLIDE_DURATION * 1000

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (slides.length > 1) {
      timerRef.current = setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % slides.length)
      }, slideDuration)
    } else {
      setCurrentIndex(0)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [slides.length, currentIndex, slideDuration])

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

      {/* Progress bar */}
      {slides.length > 1 && currentSlide && (
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
          <div className="text-2xl" style={{ color: '#4a8a74' }}>Geen actieve slides</div>
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

function PackingStatsSlide({
  data,
  title,
}: {
  data: PackingStatsResponse | null
  title: string | null
}) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-bold text-white">{title || 'Prepack + Airtec'}</div>
        <div className="text-xl" style={{ color: TV_MUTED }}>Statistieken laden…</div>
      </div>
    )
  }

  const { daily, totals, dateFrom, dateTo } = data
  const periodLabel = `${new Date(dateFrom).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — ${new Date(dateTo).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const avgItemsPerDay =
    daily.length > 0
      ? Math.round(totals.itemsPacked / Math.max(daily.filter((d) => d.itemsTotal > 0).length, 1))
      : 0

  return (
    <div className="w-full h-full flex flex-col px-8 py-5 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-5">
        <h2 className="text-3xl font-bold text-white">
          {title || 'Inpak Statistieken'}
        </h2>
        <span className="text-sm tracking-wide" style={{ color: TV_MUTED }}>
          {periodLabel}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3 shrink-0 mb-5">
        {/* Gecombineerd */}
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(74, 222, 128, 0.12)', border: '1px solid #22c55e' }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: TV_MUTED }}>Totaal verpakt</div>
          <div className="text-4xl font-bold text-white tabular-nums">{totals.itemsPacked.toLocaleString('nl-NL')}</div>
          <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
            {totals.manHours.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} manuren
          </div>
        </div>

        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(250, 204, 21, 0.08)', border: '1px solid #ca8a04' }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: TV_MUTED }}>Gem. per dag</div>
          <div className="text-4xl font-bold text-white tabular-nums">{avgItemsPerDay.toLocaleString('nl-NL')}</div>
          <div className="mt-2 text-xs" style={{ color: TV_TICK }}>stuks / werkdag</div>
        </div>

        {/* Separator */}
        <div className="flex items-center justify-center">
          <div className="w-px h-3/4 rounded" style={{ backgroundColor: TV_GRID }} />
        </div>

        {/* Prepack apart */}
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6' }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#93c5fd' }}>Prepack</div>
          <div className="text-4xl font-bold text-white tabular-nums">{totals.itemsPrepack.toLocaleString('nl-NL')}</div>
          <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
            {totals.manHoursPrepack.toFixed(1)} manuren
          </div>
        </div>

        {/* Airtec apart */}
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7' }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#c4b5fd' }}>Airtec</div>
          <div className="text-4xl font-bold text-white tabular-nums">{totals.itemsAirtec.toLocaleString('nl-NL')}</div>
          <div className="mt-2 text-xs" style={{ color: TV_TICK }}>
            {totals.manHoursAirtec.toFixed(1)} manuren
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[220px] w-full rounded-xl px-2 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        {daily.length === 0 ? (
          <p className="text-center text-lg" style={{ color: TV_MUTED }}>
            Geen data in deze periode.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={TV_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: TV_TICK, fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
                axisLine={{ stroke: TV_GRID }}
                tickLine={false}
              />
              <YAxis
                yAxisId="items"
                tick={{ fill: TV_TICK, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                label={{
                  value: 'Stuks',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fill: TV_MUTED, fontSize: 11 },
                }}
              />
              <YAxis
                yAxisId="uur"
                orientation="right"
                tick={{ fill: TV_TICK, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                label={{
                  value: 'Uren',
                  angle: 90,
                  position: 'insideRight',
                  offset: 10,
                  style: { fill: TV_MUTED, fontSize: 11 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#002b20',
                  border: '1px solid #00664d',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                }}
                labelStyle={{ color: TV_MUTED, fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  name.includes('uren')
                    ? `${Number(value).toFixed(1)} u`
                    : Number(value).toLocaleString('nl-NL') + ' stuks',
                  name,
                ]}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="items"
                dataKey="prepackItems"
                name="Prepack"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
                label={<BarLabel fill="#93c5fd" fontSize={daily.length > 10 ? 11 : 14} />}
              />
              <Bar
                yAxisId="items"
                dataKey="airtecItems"
                name="Airtec"
                fill="#a855f7"
                radius={[3, 3, 0, 0]}
                label={<BarLabel fill="#c4b5fd" fontSize={daily.length > 10 ? 11 : 14} />}
              />
              <Line
                yAxisId="uur"
                type="monotone"
                dataKey="manHoursTotal"
                name="Manuren totaal"
                stroke="#facc15"
                strokeWidth={3}
                dot={{ r: 3, fill: '#facc15', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
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

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 overflow-hidden">
      <h2 className="text-3xl font-bold text-center mb-6 text-white">
        {slide.title || 'Dagplanning'}
      </h2>

      {useManual ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <tbody>
              {manualLines.map((line, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a5c47' }}>
                  <td className="py-4 px-6 text-2xl text-white">{line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xl" style={{ color: TV_MUTED }}>Geen dagplanning ingevuld voor vandaag</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-3">
            {entries.map((entry, i) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.aanwezig
              return (
                <div
                  key={i}
                  className="rounded-xl px-5 py-3 flex items-center gap-4"
                  style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.text}30` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-semibold text-white truncate">{entry.employeeName}</div>
                    {entry.machine && (
                      <div className="text-sm mt-0.5" style={{ color: TV_TICK }}>{entry.machine}</div>
                    )}
                    {entry.notes && (
                      <div className="text-sm mt-0.5 truncate" style={{ color: TV_MUTED }}>{entry.notes}</div>
                    )}
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
                    style={{ backgroundColor: `${cfg.text}20`, color: cfg.text }}
                  >
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-16 gap-8">
      {title && <h2 className="text-3xl font-bold" style={{ color: '#4ade80' }}>{title}</h2>}

      <div className="flex items-center gap-10">
        <div className="text-center">
          <div className="text-[120px] leading-none">{data.weatherIcon}</div>
        </div>
        <div className="text-center">
          <div className="text-8xl font-bold text-white tabular-nums">{Math.round(data.temperature)}°</div>
          <div className="text-xl mt-2" style={{ color: TV_MUTED }}>{data.weatherLabel}</div>
          <div className="text-lg mt-1" style={{ color: TV_TICK }}>Wind: {data.windSpeed} km/u</div>
        </div>
      </div>

      {data.forecast.length > 0 && (
        <div className="flex gap-6 mt-4">
          {data.forecast.map((slot, i) => (
            <div key={i} className="text-center rounded-xl px-6 py-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid #1a5c47' }}>
              <div className="text-sm font-medium mb-2" style={{ color: TV_MUTED }}>{slot.label}</div>
              <div className="text-4xl mb-2">{slot.icon}</div>
              <div className="text-2xl font-bold text-white tabular-nums">{Math.round(slot.temp)}°</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
