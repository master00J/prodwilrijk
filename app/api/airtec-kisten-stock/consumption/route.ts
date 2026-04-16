import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days')) || 30

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  // Historisch verbruik uit packed_items_airtec (de primaire bron)
  const { data: packedRows } = await supabaseAdmin
    .from('packed_items_airtec')
    .select('kistnummer, quantity, date_packed')
    .gte('date_packed', sinceISO)
    .not('kistnummer', 'is', null)

  // Leveringen uit de stock log (als die tabel bestaat)
  let deliveryMap = new Map<string, number>()
  try {
    const { data: logs } = await supabaseAdmin
      .from('airtec_kisten_stock_log')
      .select('kistnummer, quantity, change_type')
      .eq('change_type', 'delivered')
      .gte('created_at', sinceISO)

    ;(logs || []).forEach((l: any) => {
      deliveryMap.set(l.kistnummer, (deliveryMap.get(l.kistnummer) || 0) + l.quantity)
    })
  } catch { /* tabel bestaat mogelijk nog niet */ }

  // Aggregeer verbruik per kistnummer vanuit packed items
  const perKist = new Map<string, number>()
  ;(packedRows || []).forEach((row: any) => {
    const kist = row.kistnummer ? String(row.kistnummer).trim() : null
    if (!kist) return
    const qty = Number(row.quantity) || 1
    perKist.set(kist, (perKist.get(kist) || 0) + qty)
  })

  // Haal stock data op voor context
  const { data: stockRows } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .select('kistnummer, huidige_voorraad, minimum_voorraad')

  const stockMap = new Map<string, any>()
  ;(stockRows || []).forEach((s: any) => stockMap.set(s.kistnummer, s))

  // Combineer alle kistnummers (verbruik + leveringen)
  const allKisten = new Set([...perKist.keys(), ...deliveryMap.keys()])

  const summary = Array.from(allKisten).map(kistnummer => {
    const consumed = perKist.get(kistnummer) || 0
    const delivered = deliveryMap.get(kistnummer) || 0
    const stock = stockMap.get(kistnummer)
    const avgPerDay = days > 0 ? consumed / days : 0
    const suggestedMin = Math.ceil(avgPerDay * 10)
    return {
      kistnummer,
      consumed,
      delivered,
      avg_per_day: Math.round(avgPerDay * 100) / 100,
      suggested_min: suggestedMin,
      current_min: stock?.minimum_voorraad || 0,
      huidige_voorraad: stock?.huidige_voorraad || 0,
    }
  })
    .filter(r => r.consumed > 0 || r.delivered > 0)
    .sort((a, b) => b.consumed - a.consumed)

  return NextResponse.json({ data: summary, days })
})
