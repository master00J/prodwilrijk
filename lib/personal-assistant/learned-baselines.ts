import { rememberAssistantFact, recallAssistantMemory } from '@/lib/personal-assistant/memory'
import { getAirtecPerformanceInsights } from '@/lib/personal-assistant/airtec-insights'
import { getPrepackPerformanceInsights } from '@/lib/personal-assistant/prepack-insights'
import { getPrepackStatsForAssistant, getAirtecStatsForAssistant } from '@/lib/personal-assistant/prepack-airtec-extra'

const PREPACK_LEARNED_KEY = 'prepack_learned'
const AIRTEC_LEARNED_KEY = 'airtec_learned'
const SUMMARY_LEARNED_KEY = 'assistant_learned_summary'

function compactInsight(insight: Awaited<ReturnType<typeof getPrepackPerformanceInsights>>) {
  return {
    period: insight.focus_period,
    items_packed: insight.focus_totals.items_packed,
    revenue: insight.focus_totals.revenue,
    items_rating: insight.evaluation.items_packed_vs_baseline.rating,
    items_pct_vs_baseline: insight.evaluation.items_packed_vs_baseline.pct_change,
    revenue_rating: insight.evaluation.revenue_vs_baseline.rating,
    baseline_items: insight.evaluation.items_packed_vs_baseline.baseline,
    rolling_7d_items: insight.benchmarks.rolling_7_day_avg.items_packed,
    same_weekday_items: insight.benchmarks.same_weekday_avg.items_packed,
    top_people: insight.top_people_focus?.slice(0, 5),
  }
}

/** Sla compacte benchmarks op in persistent geheugen (cron of na zware tool-runs). */
export async function refreshPersonalAssistantLearnedBaselines() {
  const [prepackToday, prepackWeek, prepackMonth, airtecWeek, airtecToday] = await Promise.all([
    getPrepackPerformanceInsights({ period: 'vandaag' }),
    getPrepackPerformanceInsights({ period: 'deze_week' }),
    getPrepackPerformanceInsights({ period: 'deze_maand', history_days: 60 }),
    getAirtecStatsForAssistant({ period: 'deze_week' }),
    getAirtecPerformanceInsights({ period: 'vandaag' }).catch(() => null),
  ])

  const prepackPayload = {
    updated_at: new Date().toISOString(),
    vandaag: compactInsight(prepackToday),
    deze_week: compactInsight(prepackWeek),
    deze_maand: compactInsight(prepackMonth),
  }

  const airtecPayload = {
    updated_at: new Date().toISOString(),
    vandaag: airtecToday
      ? {
          items_packed: airtecToday.focus_totals.items_packed,
          rating: airtecToday.evaluation.items_packed_vs_baseline.rating,
        }
      : null,
    deze_week: {
      items_packed: (airtecWeek.totals as { items_packed?: number }).items_packed,
      revenue: (airtecWeek.totals as { revenue?: number }).revenue,
      man_hours: (airtecWeek.totals as { man_hours?: number }).man_hours,
      top_people: (airtecWeek.people_by_hours as Array<{ name: string; man_hours: number }>)?.slice(0, 5),
    },
  }

  const summaryLines = [
    `Prepack vandaag: ${prepackPayload.vandaag.items_packed} stuks (${prepackPayload.vandaag.items_rating} vs baseline ${prepackPayload.vandaag.baseline_items}).`,
    `Prepack deze week: ${prepackPayload.deze_week.items_packed} stuks (${prepackPayload.deze_week.items_rating}).`,
    `Rolling 7d gemiddelde: ${prepackPayload.vandaag.rolling_7d_items} stuks/dag.`,
    `Airtec deze week: ${airtecPayload.deze_week.items_packed ?? '?'} stuks.`,
  ]

  await Promise.all([
    rememberAssistantFact({
      subject_type: 'general',
      subject_key: PREPACK_LEARNED_KEY,
      memory_type: 'baseline',
      value: JSON.stringify(prepackPayload),
      note: 'Auto-geleerd Prepack benchmarks (vandaag/week/maand)',
      user_id: 'system',
    }),
    rememberAssistantFact({
      subject_type: 'general',
      subject_key: AIRTEC_LEARNED_KEY,
      memory_type: 'baseline',
      value: JSON.stringify(airtecPayload),
      note: 'Auto-geleerd Airtec weekcijfers',
      user_id: 'system',
    }),
    rememberAssistantFact({
      subject_type: 'general',
      subject_key: SUMMARY_LEARNED_KEY,
      memory_type: 'baseline',
      value: summaryLines.join(' '),
      note: 'Korte NL samenvatting voor voice/chat',
      user_id: 'system',
    }),
  ])

  return {
    refreshed_at: new Date().toISOString(),
    prepack: prepackPayload,
    airtec: airtecPayload,
    summary: summaryLines.join(' '),
  }
}

function parseStoredJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export type AssistantLearnedContext = {
  source: string
  interpretation: string
  summary_text: string | null
  summary_updated_at: string | null
  stored_prepack: Record<string, unknown> | null
  stored_prepack_updated_at: string | null
  stored_airtec: Record<string, unknown> | null
  stored_airtec_updated_at: string | null
  live_prepack_today: {
    evaluation: Awaited<ReturnType<typeof getPrepackPerformanceInsights>>['evaluation']
    benchmarks: Awaited<ReturnType<typeof getPrepackPerformanceInsights>>['benchmarks']
    focus_totals: Awaited<ReturnType<typeof getPrepackPerformanceInsights>>['focus_totals']
  } | null
  prepack_week_totals: Record<string, unknown>
  has_stored_memory: boolean
}

/** Opgeslagen + live learned context voor de assistent. */
const STALE_MS = 20 * 60 * 60 * 1000

export async function getAssistantLearnedContext(input?: {
  refresh_live?: boolean
  auto_refresh_stale?: boolean
}): Promise<AssistantLearnedContext> {
  let memories = await recallAssistantMemory({
    subject_type: 'general',
    limit: 20,
  })

  let prepackStored = memories.memories.find(
    m => m.subject_key === PREPACK_LEARNED_KEY && m.memory_type === 'baseline'
  )
  let airtecStored = memories.memories.find(
    m => m.subject_key === AIRTEC_LEARNED_KEY && m.memory_type === 'baseline'
  )
  let summaryStored = memories.memories.find(
    m => m.subject_key === SUMMARY_LEARNED_KEY && m.memory_type === 'baseline'
  )

  const summaryAge = summaryStored?.updated_at
    ? Date.now() - new Date(summaryStored.updated_at).getTime()
    : Number.POSITIVE_INFINITY
  if (
    input?.auto_refresh_stale !== false &&
    (!summaryStored || summaryAge > STALE_MS)
  ) {
    try {
      await refreshPersonalAssistantLearnedBaselines()
      memories = await recallAssistantMemory({ subject_type: 'general', limit: 20 })
      prepackStored = memories.memories.find(
        m => m.subject_key === PREPACK_LEARNED_KEY && m.memory_type === 'baseline'
      )
      airtecStored = memories.memories.find(
        m => m.subject_key === AIRTEC_LEARNED_KEY && m.memory_type === 'baseline'
      )
      summaryStored = memories.memories.find(
        m => m.subject_key === SUMMARY_LEARNED_KEY && m.memory_type === 'baseline'
      )
    } catch {
      // gebruik bestaand geheugen
    }
  }

  const stored_prepack = prepackStored?.value
    ? parseStoredJson<Record<string, unknown>>(prepackStored.value)
    : null
  const stored_airtec = airtecStored?.value
    ? parseStoredJson<Record<string, unknown>>(airtecStored.value)
    : null

  let live_prepack_today: Awaited<ReturnType<typeof getPrepackPerformanceInsights>> | null = null
  if (input?.refresh_live !== false) {
    live_prepack_today = await getPrepackPerformanceInsights({ period: 'vandaag' })
  }

  const weekStats = await getPrepackStatsForAssistant({ period: 'deze_week' })

  return {
    source: 'assistant learned baselines',
    interpretation:
      'Gebruik stored_learned voor vaste benchmarks. live_prepack_today voor actuele dag. Vergelijk altijd met baseline en geef sterk/normaal/zwak terug. Verzin geen targets.',
    summary_text: summaryStored?.value || null,
    summary_updated_at: summaryStored?.updated_at || null,
    stored_prepack,
    stored_prepack_updated_at: prepackStored?.updated_at || null,
    stored_airtec,
    stored_airtec_updated_at: airtecStored?.updated_at || null,
    live_prepack_today: live_prepack_today
      ? {
          evaluation: live_prepack_today.evaluation,
          benchmarks: live_prepack_today.benchmarks,
          focus_totals: live_prepack_today.focus_totals,
        }
      : null,
    prepack_week_totals: weekStats.totals as Record<string, unknown>,
    has_stored_memory: Boolean(stored_prepack || stored_airtec),
  }
}
