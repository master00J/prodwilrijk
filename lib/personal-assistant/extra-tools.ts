import { supabaseAdmin } from '@/lib/supabase/server'
import { getPersonalAssistantDailyBriefing } from '@/lib/personal-assistant/briefing'
import { getPrepackPerformanceInsights } from '@/lib/personal-assistant/prepack-insights'
import { getAirtecPerformanceInsights } from '@/lib/personal-assistant/airtec-insights'
import { fetchPrepackQueueStats } from '@/lib/prepack/queue-stats'

export async function getLumipaperImportsSummary(input?: { limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 10, 1), 25)
  const { data, error } = await supabaseAdmin
    .from('lumipaper_imports')
    .select('id, order_number, subject, status, total_lines, unmapped_lines, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = data || []
  const partial = rows.filter(r => r.status === 'partial').length
  const errors = rows.filter(r => r.status === 'error').length

  return {
    source: 'lumipaper imports',
    recent_count: rows.length,
    partial_count: partial,
    error_count: errors,
    recent: rows.map(r => ({
      order_number: r.order_number,
      subject: r.subject,
      status: r.status,
      total_lines: r.total_lines,
      unmapped_count: Array.isArray(r.unmapped_lines) ? r.unmapped_lines.length : 0,
      created_at: r.created_at,
    })),
  }
}

export async function getWmsProjectsSummary(input?: { limit?: number; open_only?: boolean }) {
  const limit = Math.min(Math.max(input?.limit ?? 15, 1), 40)

  const { data: projects, error: projError } = await supabaseAdmin
    .from('wms_projects')
    .select('id, project_no, machine_type, vmi_ref_no, status, created_at')
    .order('created_at', { ascending: false })
    .limit(80)

  if (projError) throw projError

  let list = projects || []
  if (input?.open_only) {
    list = list.filter(p => String(p.status || '').toLowerCase() !== 'completed')
  }

  const projectIds = list.slice(0, limit).map(p => p.id)
  let lineStats: Record<number, { lines: number; open_lines: number }> = {}

  if (projectIds.length > 0) {
    const { data: lines, error: lineError } = await supabaseAdmin
      .from('wms_project_lines')
      .select('project_id, status')
      .in('project_id', projectIds)

    if (lineError) throw lineError

    for (const line of lines || []) {
      const pid = Number(line.project_id)
      if (!lineStats[pid]) lineStats[pid] = { lines: 0, open_lines: 0 }
      lineStats[pid].lines += 1
      if (String(line.status || '').toLowerCase() !== 'done') {
        lineStats[pid].open_lines += 1
      }
    }
  }

  return {
    source: 'wms projects',
    total_projects_shown: list.slice(0, limit).length,
    projects: list.slice(0, limit).map(p => ({
      project_no: p.project_no,
      machine_type: p.machine_type,
      vmi_ref_no: p.vmi_ref_no,
      status: p.status,
      lines: lineStats[p.id]?.lines ?? 0,
      open_lines: lineStats[p.id]?.open_lines ?? 0,
      created_at: p.created_at,
    })),
  }
}

export async function getPrepackProblemsSummary(input?: { limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 15, 1), 30)

  const { count: problemCount } = await supabaseAdmin
    .from('items_to_pack')
    .select('*', { count: 'exact', head: true })
    .eq('packed', false)
    .eq('problem', true)

  const { data, error } = await supabaseAdmin
    .from('items_to_pack')
    .select('id, item_number, description, amount, priority, date_added, problem_comment')
    .eq('packed', false)
    .eq('problem', true)
    .order('date_added', { ascending: true })
    .limit(limit)

  if (error) throw error

  return {
    source: 'items-to-pack',
    open_problem_lines: problemCount ?? 0,
    sample_problems: (data || []).map(r => ({
      item_number: r.item_number,
      description: r.description,
      amount: r.amount,
      priority: r.priority,
      problem_comment: r.problem_comment,
      date_added: r.date_added,
    })),
  }
}

/** Cross-domain snapshot: prepack, airtec, grote inpak, productie in één call. */
export async function getOpsSnapshot() {
  const [briefing, prepackTrend, airtecTrend, queue] = await Promise.all([
    getPersonalAssistantDailyBriefing(),
    getPrepackPerformanceInsights({ period: 'vandaag' }).catch(() => null),
    getAirtecPerformanceInsights({ period: 'vandaag' }).catch(() => null),
    fetchPrepackQueueStats(),
  ])

  return {
    source: 'ops snapshot',
    generated_at: new Date().toISOString(),
    briefing,
    prepack_today_rating: prepackTrend?.evaluation?.items_packed_vs_baseline?.rating ?? null,
    prepack_today_items: prepackTrend?.focus_totals?.items_packed ?? null,
    airtec_today_rating: airtecTrend?.evaluation?.items_packed_vs_baseline?.rating ?? null,
    airtec_today_items: airtecTrend?.focus_totals?.items_packed ?? null,
    queue_stuks: queue.queueStuks,
    queue_priority_stuks: queue.priorityStuks,
    grote_inpak_priority: briefing.grote_inpak?.priority_cases,
    active_production_orders: briefing.active_production?.active_orders,
  }
}
