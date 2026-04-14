import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WMO_LABELS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Helder', icon: '☀️' },
  1: { label: 'Overwegend helder', icon: '🌤️' },
  2: { label: 'Halfbewolkt', icon: '⛅' },
  3: { label: 'Bewolkt', icon: '☁️' },
  45: { label: 'Mist', icon: '🌫️' },
  48: { label: 'Aanvriezende mist', icon: '🌫️' },
  51: { label: 'Lichte motregen', icon: '🌦️' },
  53: { label: 'Motregen', icon: '🌦️' },
  55: { label: 'Zware motregen', icon: '🌧️' },
  61: { label: 'Lichte regen', icon: '🌦️' },
  63: { label: 'Regen', icon: '🌧️' },
  65: { label: 'Zware regen', icon: '🌧️' },
  71: { label: 'Lichte sneeuw', icon: '🌨️' },
  73: { label: 'Sneeuw', icon: '❄️' },
  75: { label: 'Zware sneeuw', icon: '❄️' },
  80: { label: 'Lichte buien', icon: '🌦️' },
  81: { label: 'Buien', icon: '🌧️' },
  82: { label: 'Zware buien', icon: '⛈️' },
  95: { label: 'Onweer', icon: '⛈️' },
  96: { label: 'Onweer met hagel', icon: '⛈️' },
  99: { label: 'Zwaar onweer met hagel', icon: '⛈️' },
}

function getWmo(code: number) {
  return WMO_LABELS[code] || { label: 'Onbekend', icon: '🌡️' }
}

let cachedData: any = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lat = parseFloat(searchParams.get('lat') || '51.16')
    const lon = parseFloat(searchParams.get('lon') || '4.39')

    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`
    if (cachedData && cachedData._key === cacheKey && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'no-store, must-revalidate' },
      })
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBrussels&forecast_days=7`

    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)

    const json = await res.json()

    const current = json.current || {}
    const wmo = getWmo(current.weather_code ?? 0)

    const daily = json.daily || {}
    const dates: string[] = daily.time || []
    const maxTemps: number[] = daily.temperature_2m_max || []
    const minTemps: number[] = daily.temperature_2m_min || []
    const dayCodes: number[] = daily.weather_code || []
    const precipitation: number[] = daily.precipitation_sum || []
    const windMax: number[] = daily.wind_speed_10m_max || []

    const DAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']

    const weekForecast = dates.map((dateStr: string, i: number) => {
      const d = new Date(dateStr + 'T12:00:00')
      const dayWmo = getWmo(dayCodes[i] ?? 0)
      const isToday = dateStr === new Date().toISOString().split('T')[0]
      return {
        date: dateStr,
        dayName: isToday ? 'Vandaag' : DAY_NAMES[d.getDay()],
        tempMax: maxTemps[i] ?? 0,
        tempMin: minTemps[i] ?? 0,
        code: dayCodes[i] ?? 0,
        icon: dayWmo.icon,
        label: dayWmo.label,
        precipitation: precipitation[i] ?? 0,
        windMax: windMax[i] ?? 0,
      }
    })

    const result = {
      _key: cacheKey,
      temperature: current.temperature_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      weatherCode: current.weather_code ?? 0,
      weatherLabel: wmo.label,
      weatherIcon: wmo.icon,
      weekForecast,
    }

    cachedData = result
    cacheTime = Date.now()

    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: unknown) {
    console.error('weather:', error)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }
    return NextResponse.json({ error: 'Kon weerdata niet laden' }, { status: 500 })
  }
}
