import { rememberAssistantFact, recallAssistantMemory } from '@/lib/personal-assistant/memory'
import {
  getPrepackStatsForAssistant,
  getAirtecStatsForAssistant,
} from '@/lib/personal-assistant/prepack-airtec-extra'

export type HourlyPackedSchedule = {
  enabled: boolean
  interval_minutes: number
}

function scheduleKey(userId: string) {
  return `hourly_packed:${userId}`
}

export async function getHourlyPackedSchedule(userId: string | null | undefined): Promise<HourlyPackedSchedule> {
  const fallback: HourlyPackedSchedule = { enabled: false, interval_minutes: 60 }
  if (!userId) return fallback

  const { memories } = await recallAssistantMemory({
    subject_type: 'general',
    subject_key: scheduleKey(userId),
    limit: 1,
  })

  const row = memories[0]
  if (!row?.value) return fallback

  try {
    const parsed = JSON.parse(row.value) as Partial<HourlyPackedSchedule>
    return {
      enabled: Boolean(parsed.enabled),
      interval_minutes: Math.min(Math.max(Number(parsed.interval_minutes) || 60, 15), 240),
    }
  } catch {
    return fallback
  }
}

export async function setHourlyPackedSchedule(
  userId: string,
  input: { enabled: boolean; interval_minutes?: number }
): Promise<HourlyPackedSchedule> {
  const schedule: HourlyPackedSchedule = {
    enabled: input.enabled,
    interval_minutes: Math.min(Math.max(input.interval_minutes ?? 60, 15), 240),
  }

  await rememberAssistantFact({
    subject_type: 'general',
    subject_key: scheduleKey(userId),
    memory_type: 'preference',
    value: JSON.stringify(schedule),
    note: 'Uurlijkse gesproken update: verpakte stuks Prepack en Airtec (vandaag).',
    user_id: userId,
  })

  return schedule
}

/** Korte zin voor TTS / notificatie. */
export async function buildHourlyPackedAnnouncement(): Promise<{
  text: string
  prepack_items_packed: number
  airtec_items_packed: number
  generated_at: string
}> {
  const [prepack, airtec] = await Promise.all([
    getPrepackStatsForAssistant({ period: 'vandaag' }),
    getAirtecStatsForAssistant({ period: 'vandaag' }),
  ])

  const prepackTotals = prepack.totals as { items_packed?: number }
  const airtecTotals = airtec.totals as { items_packed?: number }
  const prepackItems = Math.round(Number(prepackTotals.items_packed ?? 0))
  const airtecItems = Math.round(Number(airtecTotals.items_packed ?? 0))

  const text = `Uurupdate. Prepack vandaag: ${prepackItems} stuks verpakt. Airtec vandaag: ${airtecItems} stuks verpakt.`

  return {
    text,
    prepack_items_packed: prepackItems,
    airtec_items_packed: airtecItems,
    generated_at: new Date().toISOString(),
  }
}
