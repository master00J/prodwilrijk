import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days')) || 30

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: logs, error } = await supabaseAdmin
    .from('airtec_kisten_stock_log')
    .select('kistnummer, change_type, quantity, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Fout bij ophalen verbruik data' }, { status: 500 })
  }

  // Aggregeer per kistnummer
  const perKist = new Map<string, { consumed: number; delivered: number; entries: any[] }>()
  ;(logs || []).forEach((log: any) => {
    if (!perKist.has(log.kistnummer)) {
      perKist.set(log.kistnummer, { consumed: 0, delivered: 0, entries: [] })
    }
    const k = perKist.get(log.kistnummer)!
    if (log.change_type === 'consumed') k.consumed += log.quantity
    if (log.change_type === 'delivered') k.delivered += log.quantity
    k.entries.push(log)
  })

  // Haal stock data op voor context
  const { data: stockRows } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .select('kistnummer, huidige_voorraad, minimum_voorraad')

  const stockMap = new Map<string, any>()
  ;(stockRows || []).forEach((s: any) => stockMap.set(s.kistnummer, s))

  const summary = Array.from(perKist.entries()).map(([kistnummer, data]) => {
    const stock = stockMap.get(kistnummer)
    const avgPerDay = days > 0 ? data.consumed / days : 0
    // Suggestie: 2 weken buffer (10 werkdagen) op basis van gemiddeld verbruik
    const suggestedMin = Math.ceil(avgPerDay * 10)
    return {
      kistnummer,
      consumed: data.consumed,
      delivered: data.delivered,
      avg_per_day: Math.round(avgPerDay * 100) / 100,
      suggested_min: suggestedMin,
      current_min: stock?.minimum_voorraad || 0,
      huidige_voorraad: stock?.huidige_voorraad || 0,
    }
  }).sort((a, b) => b.consumed - a.consumed)

  return NextResponse.json({ data: summary, logs: logs || [], days })
})
