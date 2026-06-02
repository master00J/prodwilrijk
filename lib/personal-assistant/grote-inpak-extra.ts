import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export async function getGroteInpakKanbanSummary(limit = 12) {
  const { data: configRaw, error } = await supabaseAdmin
    .from('grote_inpak_kanban_config')
    .select(
      'case_type, productielocatie, prioriteit, verbruik_per_dag, stapel, posities, stapels_per_pos, rek_sectie, rek_niveau, rek_kolom'
    )
    .eq('actief', true)
    .order('verbruik_per_dag', { ascending: false, nullsFirst: false })
    .limit(80)

  if (error) throw error

  const config = (configRaw || []).filter(row => {
    const ct = String(row.case_type || '').trim().toUpperCase()
    return ct.startsWith('C')
  })

  const kists = config.map(row => normalizeKistnummer(String(row.case_type || ''))).filter(Boolean)
  const stockByKist = new Map<string, { totaal: number; willebroek: number; in_productie: number }>()

  if (kists.length > 0) {
    const { data: stockRows } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('kistnummer, location, quantity, productie')

    for (const row of stockRows || []) {
      const kist = normalizeKistnummer(String(row.kistnummer || ''))
      if (!kist || !kists.includes(kist)) continue
      const loc = String(row.location || '').toLowerCase()
      const qty = Number(row.quantity) || 0
      const prod = Number(row.productie) || 0
      const cur = stockByKist.get(kist) || { totaal: 0, willebroek: 0, in_productie: 0 }
      cur.totaal += qty
      cur.in_productie += prod
      if (loc.includes('willebroek')) cur.willebroek += qty
      stockByKist.set(kist, cur)
    }
  }

  const enriched = config.map(row => {
    const kt = normalizeKistnummer(String(row.case_type || ''))
    const stock = stockByKist.get(kt) || { totaal: 0, willebroek: 0, in_productie: 0 }
    const maxVoorraad = Math.max(1, Number(row.posities || 1) * Number(row.stapels_per_pos || 2))
    const stockInRek = Math.min(stock.totaal, maxVoorraad)
    const tekort = Math.max(0, maxVoorraad - stockInRek)
    return {
      case_type: kt,
      productielocatie: row.productielocatie,
      prioriteit: row.prioriteit,
      verbruik_per_dag: row.verbruik_per_dag,
      stock_in_rek: stockInRek,
      max_voorraad: maxVoorraad,
      tekort,
      stock_totaal: stock.totaal,
      in_productie: stock.in_productie,
      rek: `${row.rek_sectie || ''} ${row.rek_niveau || ''}/${row.rek_kolom || ''}`.trim(),
    }
  })

  const urgent = [...enriched]
    .sort((a, b) => {
      if (a.tekort !== b.tekort) return b.tekort - a.tekort
      return (Number(b.verbruik_per_dag) || 0) - (Number(a.verbruik_per_dag) || 0)
    })
    .slice(0, Math.min(Math.max(limit, 1), 25))

  return {
    source: 'grote-inpak kanban',
    active_c_kisten: config.length,
    urgent_kanban: urgent,
  }
}

export async function getGroteInpakStockLookup(kistnummer: string) {
  const code = normalizeCode(kistnummer)
  const { data: stockRows, error } = await supabaseAdmin
    .from('grote_inpak_stock')
    .select('erp_code, kistnummer, location, quantity, productie, item_number')
    .or(`kistnummer.ilike.%${code}%,erp_code.ilike.%${code}%`)
    .limit(200)

  if (error) throw error

  const rows = stockRows || []
  const byLocation: Record<string, number> = {}
  let totalQty = 0
  let totalProd = 0

  for (const row of rows) {
    const loc = row.location || 'Onbekend'
    const qty = Number(row.quantity) || 0
    const prod = Number(row.productie) || 0
    byLocation[loc] = (byLocation[loc] || 0) + qty
    totalQty += qty
    totalProd += prod
  }

  const { data: erpRow } = await supabaseAdmin
    .from('grote_inpak_erp_link')
    .select('kistnummer, erp_code, stapel, productielocatie')
    .ilike('kistnummer', `%${code}%`)
    .limit(5)

  return {
    kistnummer: code,
    stock_rows: rows.length,
    total_quantity: totalQty,
    total_on_prod_order: totalProd,
    by_location: byLocation,
    erp_link: erpRow || [],
    sample: rows.slice(0, 8).map(r => ({
      location: r.location,
      quantity: r.quantity,
      productie: r.productie,
      erp_code: r.erp_code,
    })),
  }
}

export async function getGroteInpakBacklogSummary(limit = 20) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: cases, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('case_label, case_type, productielocatie, status, arrival_date, forecast_date, in_willebroek')
    .limit(500)

  if (error) throw error

  const { data: packedRows } = await supabaseAdmin
    .from('grote_inpak_packed')
    .select('case_label')
    .limit(2000)

  const packedLabels = new Set(
    (packedRows || []).map(r => String(r.case_label || '').trim()).filter(Boolean)
  )

  const backlog = (cases || [])
    .filter(row => {
      if (packedLabels.has(String(row.case_label || '').trim())) return false
      if (row.in_willebroek) return false
      const ref = row.forecast_date || row.arrival_date
      if (!ref) return false
      const d = new Date(ref)
      d.setHours(0, 0, 0, 0)
      return d < today
    })
    .map(row => {
      const ref = row.forecast_date || row.arrival_date
      const d = new Date(ref!)
      d.setHours(0, 0, 0, 0)
      const dagen = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
      return {
        case_label: row.case_label,
        case_type: row.case_type,
        productielocatie: row.productielocatie,
        status: row.status,
        dagen_te_laat: dagen,
        ref_date: ref,
      }
    })
    .sort((a, b) => b.dagen_te_laat - a.dagen_te_laat)

  const kCount = backlog.filter(r => /^K\d/i.test(String(r.case_type || ''))).length
  const cCount = backlog.filter(r => /^C\d/i.test(String(r.case_type || ''))).length

  return {
    source: 'grote-inpak backlog tab',
    total_backlog: backlog.length,
    k_cases: kCount,
    c_cases: cCount,
    top_backlog: backlog.slice(0, Math.min(Math.max(limit, 1), 30)),
  }
}

export async function getGroteInpakProductionOrdersSummary(input?: { kistnummer?: string }) {
  const code = input?.kistnummer ? normalizeCode(input.kistnummer) : null

  let query = supabaseAdmin
    .from('grote_inpak_production_orders')
    .select('kistnummer, prod_order_no, remaining_quantity, ending_date, productielocatie, bc_source')
    .gt('remaining_quantity', 0)
    .order('ending_date', { ascending: true, nullsFirst: false })
    .limit(300)

  if (code) {
    query = query.eq('kistnummer', code)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data || []
  const byLocation: Record<string, number> = {}
  const byKist: Record<string, number> = {}

  for (const row of rows) {
    const loc = row.productielocatie || 'Onbekend'
    byLocation[loc] = (byLocation[loc] || 0) + 1
    const k = row.kistnummer || '?'
    byKist[k] = (byKist[k] || 0) + 1
  }

  const topKisten = Object.entries(byKist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kistnummer, open_orders]) => ({ kistnummer, open_orders }))

  return {
    source: 'grote-inpak productieorders tab',
    filter_kist: code,
    open_orders: rows.length,
    by_location: byLocation,
    top_kisten: topKisten,
    earliest_orders: rows.slice(0, 12).map(r => ({
      kistnummer: r.kistnummer,
      prod_order_no: r.prod_order_no,
      remaining_quantity: Number(r.remaining_quantity ?? 0),
      ending_date: r.ending_date,
      productielocatie: r.productielocatie,
    })),
  }
}
