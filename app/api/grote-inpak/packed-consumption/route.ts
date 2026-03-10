import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── GET: Verbruiksanalyse per kisttype ───────────────────────────────────────
// Query params:
//   days        = aantal dagen terug (default: 365)
//   lead_time   = doorlooptijd in werkdagen (default: 5)
//   safety_days = extra veiligheidsdagen (default: 3)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days       = Math.max(1, Math.min(730, parseInt(searchParams.get('days')       || '365', 10)))
    const leadTime   = Math.max(1, Math.min(30,  parseInt(searchParams.get('lead_time')  || '5',   10)))
    const safetyDays = Math.max(0, Math.min(30,  parseInt(searchParams.get('safety_days')|| '3',   10)))

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    // 1. Verbruik uit consumption tabel
    const { data: rawConsumption, error: consErr } = await supabaseAdmin
      .from('grote_inpak_packed_consumption')
      .select('case_type, scan_date, quantity, source_type')
      .gte('scan_date', sinceStr)
      .order('scan_date', { ascending: true })

    if (consErr) throw consErr

    // 2. Kanban config (voor huidige instellingen en suggestie-vergelijking)
    const { data: configRaw } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .select('id, case_type, verbruik_per_dag, stapel, posities, stapels_per_pos, productielocatie, prioriteit')
      .eq('actief', true)

    const configByKist = new Map<string, any>()
    ;(configRaw || []).forEach((c: any) => {
      configByKist.set(String(c.case_type).toUpperCase().trim(), c)
    })

    // 3. Aggregeer per kisttype
    const statsByKist = new Map<string, {
      total: number
      days_with_data: Set<string>
      months: Map<string, number>
    }>()

    ;(rawConsumption || []).forEach((row: any) => {
      const kt = String(row.case_type || '').toUpperCase().trim()
      if (!kt) return
      if (!statsByKist.has(kt)) {
        statsByKist.set(kt, { total: 0, days_with_data: new Set(), months: new Map() })
      }
      const entry = statsByKist.get(kt)!
      entry.total += row.quantity
      entry.days_with_data.add(row.scan_date)

      // Maand-aggregatie (YYYY-MM)
      const month = String(row.scan_date || '').slice(0, 7)
      entry.months.set(month, (entry.months.get(month) || 0) + row.quantity)
    })

    // 4. Bouw gesorteerde resultaten
    const result = Array.from(statsByKist.entries())
      .map(([caseType, s]) => {
        const activeDays = s.days_with_data.size
        const avgPerDay = activeDays > 0
          ? Math.round((s.total / activeDays) * 100) / 100
          : 0

        const config = configByKist.get(caseType)
        const stapel = config?.stapel || 1
        const stapelsPerPos = config?.stapels_per_pos || 2

        // Afronden naar boven op een veelvoud van stapel
        const roundUpToStapel = (n: number) =>
          stapel > 1 ? Math.ceil(n / stapel) * stapel : Math.ceil(n)

        // Suggesties — min en max altijd een veelvoud van de stapelhoogte
        const suggestedVerbruikPerDag = avgPerDay
        const suggestedMin = roundUpToStapel(avgPerDay * leadTime)
        const suggestedMax = roundUpToStapel(avgPerDay * (leadTime + safetyDays))
        const suggestedPosities = stapelsPerPos > 0 && stapel > 0
          ? Math.max(1, Math.ceil(suggestedMax / (stapel * stapelsPerPos)))
          : null
        const currentMax = config
          ? config.posities * config.stapel * config.stapels_per_pos
          : null

        // Maandoverzicht (gesorteerd)
        const monthly = Array.from(s.months.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count }))

        return {
          case_type: caseType,
          total: s.total,
          active_days: activeDays,
          avg_per_day: avgPerDay,
          monthly,
          // config info
          in_config: !!config,
          config_id: config?.id ?? null,
          productielocatie: config?.productielocatie ?? null,
          current_verbruik_per_dag: config?.verbruik_per_dag ?? null,
          current_max: currentMax,
          // suggesties
          suggested_verbruik_per_dag: suggestedVerbruikPerDag,
          suggested_min: suggestedMin,
          suggested_max: suggestedMax,
          suggested_posities: suggestedPosities,
        }
      })
      .sort((a, b) => b.total - a.total) // Meest verbruikt eerst

    // 5. KPI samenvatting
    const totalKisten = result.reduce((s, r) => s + r.total, 0)
    const inConfig    = result.filter(r => r.in_config).length
    const notInConfig = result.filter(r => !r.in_config).length
    const topKist     = result[0]?.case_type ?? null

    // 6. Case types die WEL in config staan maar GEEN data hebben
    const missingInData = (configRaw || [])
      .filter((c: any) => {
        const kt = String(c.case_type || '').toUpperCase().trim()
        return kt.startsWith('C') && !statsByKist.has(kt)
      })
      .map((c: any) => ({
        case_type: String(c.case_type).toUpperCase().trim(),
        in_config: true,
        config_id: c.id,
        productielocatie: c.productielocatie,
        current_verbruik_per_dag: c.verbruik_per_dag,
        total: 0,
        active_days: 0,
        avg_per_day: 0,
        monthly: [],
        current_max: c.posities * c.stapel * c.stapels_per_pos,
        suggested_verbruik_per_dag: 0,
        suggested_min: 0,
        suggested_max: 0,
        suggested_posities: null,
      }))

    return NextResponse.json({
      data: [...result, ...missingInData],
      meta: {
        since: sinceStr,
        days,
        lead_time: leadTime,
        safety_days: safetyDays,
        total_kisten_verbruikt: totalKisten,
        unieke_typen: result.length,
        in_kanban_config: inConfig,
        niet_in_config: notInConfig,
        meest_gebruikt: topKist,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── PATCH: Pas verbruik_per_dag bij in kanban_config ─────────────────────────
// Body: { updates: [{ id: number, verbruik_per_dag: number }] }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body as { updates: { id: number; verbruik_per_dag: number }[] }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Geen updates meegegeven' }, { status: 400 })
    }

    const errors: string[] = []
    let updated = 0

    for (const u of updates) {
      if (!u.id || typeof u.verbruik_per_dag !== 'number') continue
      const { error } = await supabaseAdmin
        .from('grote_inpak_kanban_config')
        .update({ verbruik_per_dag: Math.round(u.verbruik_per_dag * 100) / 100 })
        .eq('id', u.id)
      if (error) errors.push(`id ${u.id}: ${error.message}`)
      else updated++
    }

    return NextResponse.json({
      updated,
      errors: errors.length ? errors : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
