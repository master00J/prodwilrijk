import { fetchPrepackQueueStats } from '@/lib/prepack/queue-stats'
import { getGroteInpakKanbanSummary } from '@/lib/personal-assistant/grote-inpak-extra'
import {
  getPrepackStatsForAssistant,
  getAirtecStatsForAssistant,
} from '@/lib/personal-assistant/prepack-airtec-extra'
import { getActiveProductionSummary } from '@/lib/personal-assistant/production-extra'
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

/** Ochtend-/check-in briefing: combineert de belangrijkste live KPI's. */
export async function getPersonalAssistantDailyBriefing() {
  const [queue, groteInpak, prepackWeek, airtecWeek, activeProduction, kanban, packed] =
    await Promise.all([
      fetchPrepackQueueStats(),
      quickGroteInpakCounts(),
      getPrepackStatsForAssistant({ period: 'deze_week' }),
      getAirtecStatsForAssistant({ period: 'deze_week' }),
      getActiveProductionSummary(),
      getGroteInpakKanbanSummary(6),
      quickPackedThisWeek(),
    ])

  return {
    generated_at: new Date().toISOString(),
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
  }
}
