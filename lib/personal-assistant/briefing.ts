import { fetchPrepackQueueStats } from '@/lib/prepack/queue-stats'
import { getGroteInpakKanbanSummary } from '@/lib/personal-assistant/grote-inpak-extra'
import {
  getPrepackStatsForAssistant,
  getAirtecStatsForAssistant,
} from '@/lib/personal-assistant/prepack-airtec-extra'
import { getActiveProductionSummary } from '@/lib/personal-assistant/production-extra'
import { getAssistantLearnedContext } from '@/lib/personal-assistant/learned-baselines'
import { supabaseAdmin } from '@/lib/supabase/server'

async function quickGroteInpakCounts() {
  const { data, error } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('priority, in_willebroek, arrival_date, forecast_date')

  if (error) throw error

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rows = data || []
  let priority = 0
  let overdue = 0
  let inWillebroek = 0

  for (const row of rows) {
    if (row.priority) priority += 1
    if (row.in_willebroek) inWillebroek += 1
    const ref = row.forecast_date || row.arrival_date
    if (ref && !row.in_willebroek) {
      const d = new Date(ref)
      d.setHours(0, 0, 0, 0)
      if (d < today) overdue += 1
    }
  }

  return { total_cases: rows.length, priority_cases: priority, overdue_cases: overdue, in_willebroek: inWillebroek }
}

async function quickPackedThisWeek() {
  const from = new Date()
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0]
  const [{ count: packed }, { count: drafts }] = await Promise.all([
    supabaseAdmin
      .from('grote_inpak_packed')
      .select('*', { count: 'exact', head: true })
      .gte('packed_date', fromStr),
    supabaseAdmin
      .from('grote_inpak_packed_import_batches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
  ])
  return { packed_rows: packed ?? 0, draft_import_batches: drafts ?? 0 }
}

async function quickLumipaperAlerts() {
  const from = new Date()
  from.setDate(from.getDate() - 14)
  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .select('status')
    .gte('created_at', from.toISOString())
    .limit(50)

  if (error) throw error
  const rows = data || []
  return {
    recent_imports: rows.length,
    partial: rows.filter(r => r.status === 'partial').length,
    error: rows.filter(r => r.status === 'error').length,
  }
}

async function quickWmsOpen() {
  const { data, error } = await supabaseAdmin
    .from('wms_projects')
    .select('status')
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw error
  const rows = data || []
  const open = rows.filter(p => String(p.status || '').toLowerCase() !== 'completed')
  return { open_projects: open.length, total_recent: rows.length }
}

async function quickPrepackProblemCount() {
  const { count, error } = await supabaseAdmin
    .from('items_to_pack')
    .select('*', { count: 'exact', head: true })
    .eq('packed', false)
    .eq('problem', true)

  if (error) throw error
  return { open_problem_lines: count ?? 0 }
}

/** Ochtend-/check-in briefing: combineert de belangrijkste live KPI's. */
export async function getPersonalAssistantDailyBriefing() {
  const [
    queue,
    groteInpak,
    prepackWeek,
    airtecWeek,
    activeProduction,
    kanban,
    packed,
    learned,
    lumipaper,
    wms,
    prepackProblems,
  ] = await Promise.all([
    fetchPrepackQueueStats(),
    quickGroteInpakCounts(),
    getPrepackStatsForAssistant({ period: 'deze_week' }),
    getAirtecStatsForAssistant({ period: 'deze_week' }),
    getActiveProductionSummary(),
    getGroteInpakKanbanSummary(6),
    quickPackedThisWeek(),
    getAssistantLearnedContext().catch(() => null),
    quickLumipaperAlerts().catch(() => null),
    quickWmsOpen().catch(() => null),
    quickPrepackProblemCount().catch(() => null),
  ])

  return {
    generated_at: new Date().toISOString(),
    learned_summary: learned?.summary_text || null,
    learned_prepack_today: learned?.live_prepack_today?.focus_totals || null,
    prepack_queue: {
      queue_stuks: queue.queueStuks,
      backlog_stuks: queue.backlogStuks,
      priority_stuks: queue.priorityStuks,
      oldest_working_days: queue.oldestWorkingDays,
      top_critical: queue.topCritical.slice(0, 3),
    },
    prepack_week: prepackWeek.totals,
    airtec_week: airtecWeek.totals,
    grote_inpak: groteInpak,
    packed_this_week: packed,
    active_production: {
      active_sessions: activeProduction.active_sessions,
      active_orders: activeProduction.active_orders,
    },
    kanban_urgent: kanban.urgent_kanban,
    lumipaper: lumipaper,
    wms: wms,
    prepack_problems: prepackProblems,
  }
}
