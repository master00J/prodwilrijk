import { supabaseAdmin } from '@/lib/supabase/server'
import { aggregateStageKistenNeedForQueue } from '@/lib/prepack/stage-kisten-stock'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import { fetchAirtecStats } from '@/lib/airtec/stats'
import { resolveAssistantDateRange, previousPeriodRange } from '@/lib/personal-assistant/date-range'

function compactTotals(totals: {
  totalItemsPacked: number
  totalManHours: number
  totalRevenue: number
  totalMaterialCost: number
  totalIncoming: number
  averageItemsPerFte: number
  avgLeadTimeHours: number | null
  incomingVsPackedRatio: number | null
}) {
  const grossMargin =
    totals.totalRevenue > 0
      ? Math.round((totals.totalRevenue - totals.totalMaterialCost) * 100) / 100
      : null
  return {
    items_packed: totals.totalItemsPacked,
    man_hours: Math.round(totals.totalManHours * 10) / 10,
    revenue: Math.round(totals.totalRevenue * 100) / 100,
    material_cost: Math.round(totals.totalMaterialCost * 100) / 100,
    gross_margin: grossMargin,
    incoming_items: totals.totalIncoming,
    incoming_vs_packed_ratio: totals.incomingVsPackedRatio,
    avg_items_per_fte: Math.round(totals.averageItemsPerFte * 10) / 10,
    avg_lead_time_hours: totals.avgLeadTimeHours,
  }
}

export async function getPrepackStatsForAssistant(input?: {
  date_from?: string
  date_to?: string
  period?: string
  compare_previous_period?: boolean
}) {
  const range = resolveAssistantDateRange({ ...input, defaultDays: 7 })
  const raw = await fetchPrepackStats({
    dateFrom: range.date_from,
    dateTo: range.date_to,
    includeDetails: false,
  })

  const result: Record<string, unknown> = {
    source: 'admin/prepack',
    period: range,
    totals: compactTotals(raw.totals),
    daily_stats: raw.dailyStats.slice(-14),
    top_people: [...raw.personStats]
      .sort((a, b) => b.manHours - a.manHours)
      .slice(0, 6)
      .map(p => ({ name: p.name, man_hours: Math.round(p.manHours * 10) / 10 })),
  }

  if (input?.compare_previous_period) {
    const prev = previousPeriodRange(range)
    const prevRaw = await fetchPrepackStats({
      dateFrom: prev.date_from,
      dateTo: prev.date_to,
      includeDetails: false,
    })
    result.previous_period = prev
    result.previous_totals = compactTotals(prevRaw.totals)
    result.delta = {
      items_packed: raw.totals.totalItemsPacked - prevRaw.totals.totalItemsPacked,
      revenue: Math.round((raw.totals.totalRevenue - prevRaw.totals.totalRevenue) * 100) / 100,
      man_hours: Math.round((raw.totals.totalManHours - prevRaw.totals.totalManHours) * 10) / 10,
    }
  }

  return result
}

export async function getAirtecStatsForAssistant(input?: {
  date_from?: string
  date_to?: string
  period?: string
  compare_previous_period?: boolean
}) {
  const range = resolveAssistantDateRange({ ...input, defaultDays: 7 })
  const raw = await fetchAirtecStats({
    dateFrom: range.date_from,
    dateTo: range.date_to,
    includeDetails: false,
  })

  const result: Record<string, unknown> = {
    source: 'admin/airtec',
    period: range,
    totals: compactTotals(raw.totals),
    daily_stats: raw.dailyStats.slice(-14),
    top_people: [...raw.personStats]
      .sort((a, b) => b.manHours - a.manHours)
      .slice(0, 6)
      .map(p => ({ name: p.name, man_hours: Math.round(p.manHours * 10) / 10 })),
  }

  if (input?.compare_previous_period) {
    const prev = previousPeriodRange(range)
    const prevRaw = await fetchAirtecStats({
      dateFrom: prev.date_from,
      dateTo: prev.date_to,
      includeDetails: false,
    })
    result.previous_period = prev
    result.previous_totals = compactTotals(prevRaw.totals)
    result.delta = {
      items_packed: raw.totals.totalItemsPacked - prevRaw.totals.totalItemsPacked,
      revenue: Math.round((raw.totals.totalRevenue - prevRaw.totals.totalRevenue) * 100) / 100,
      man_hours: Math.round((raw.totals.totalManHours - prevRaw.totals.totalManHours) * 10) / 10,
    }
  }

  return result
}

export async function getPrepackStageKistenSummary() {
  const { data: queueItems, error } = await supabaseAdmin
    .from('items_to_pack')
    .select('item_number, amount')
    .eq('packed', false)
    .limit(600)

  if (error) throw error

  const rows = queueItems || []
  const { totals, perItem } = await aggregateStageKistenNeedForQueue(rows)

  const topItems = perItem
    .filter(item => item.erp_codes.length > 0)
    .slice(0, 8)
    .map(item => ({
      item_number: item.item_number,
      amount: item.amount,
      stage_codes: item.erp_codes.slice(0, 4),
    }))

  return {
    source: 'admin/prepack stage-kisten',
    queue_lines: rows.length,
    totals,
    top_stage_needs: topItems,
  }
}

export async function getAirtecStockSummary(input?: { low_stock_only?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 15, 1), 40)
  const { data, error } = await supabaseAdmin
    .from('airtec_kisten_stock')
    .select('kistnummer, erp_code, huidige_voorraad, minimum_voorraad')
    .order('kistnummer', { ascending: true })

  if (error) throw error

  let rows = (data || []).map(row => {
    const huidig = Number(row.huidige_voorraad) || 0
    const minimum = Number(row.minimum_voorraad) || 0
    const te_bestellen = Math.max(0, minimum - huidig)
    return {
      kistnummer: row.kistnummer,
      erp_code: row.erp_code,
      huidige_voorraad: huidig,
      minimum_voorraad: minimum,
      te_bestellen,
      low: huidig < minimum,
    }
  })

  if (input?.low_stock_only) {
    rows = rows.filter(r => r.low)
  }

  rows.sort((a, b) => b.te_bestellen - a.te_bestellen)

  return {
    source: 'admin/airtec kistenvoorraad',
    total_kisten: (data || []).length,
    low_stock_count: (data || []).filter(r => (Number(r.huidige_voorraad) || 0) < (Number(r.minimum_voorraad) || 0))
      .length,
    items: rows.slice(0, limit),
  }
}
