import { supabaseAdmin } from '@/lib/supabase/server'
import { getWorkingDaysBetween } from '@/lib/utils/workdays'

function countWorkingDays(from: Date, to: Date): number {
  return getWorkingDaysBetween(from, to)
}

export type PrepackQueueStats = {
  queueStuks: number
  queueLines: number
  backlogStuks: number
  backlogLines: number
  priorityStuks: number
  oldestWorkingDays: number
  avgLeadTimeDays: number | null
  backlogPct: number
  topCritical: Array<{
    id: number
    item_number: string | null
    description: string | null
    amount: number
    priority: boolean
    date_added: string
    workingDaysOld: number
  }>
}

/** Live wachtrij-KPI's zoals op /admin/prepack (wachtrij-sectie). */
export async function fetchPrepackQueueStats(): Promise<PrepackQueueStats> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let daysBack = 0
  let workingDaysCounted = 0
  while (workingDaysCounted < 3) {
    daysBack++
    const d = new Date(now)
    d.setDate(d.getDate() - daysBack)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) workingDaysCounted++
  }
  const backlogThreshold = new Date(now)
  backlogThreshold.setDate(backlogThreshold.getDate() - daysBack)

  const { data: queueItems, error: queueError } = await supabaseAdmin
    .from('items_to_pack')
    .select('id, item_number, description, amount, priority, date_added')
    .eq('packed', false)

  if (queueError) throw queueError

  const items = queueItems ?? []

  const queueStuks = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const queueLines = items.length

  const backlogItems = items.filter(i => {
    const d = new Date(i.date_added)
    d.setHours(0, 0, 0, 0)
    return d < backlogThreshold
  })
  const backlogStuks = backlogItems.reduce((sum, i) => sum + (i.amount || 0), 0)
  const backlogLines = backlogItems.length

  const priorityStuks = items
    .filter(i => i.priority)
    .reduce((sum, i) => sum + (i.amount || 0), 0)

  let oldestWorkingDays = 0
  if (items.length > 0) {
    const oldest = items.reduce((min, i) =>
      new Date(i.date_added) < new Date(min.date_added) ? i : min
    )
    oldestWorkingDays = countWorkingDays(new Date(oldest.date_added), now)
  }

  const since60 = new Date(now)
  since60.setDate(since60.getDate() - 60)

  const { data: recentPacked, error: packedError } = await supabaseAdmin
    .from('packed_items')
    .select('date_added, date_packed')
    .gte('date_packed', since60.toISOString())
    .not('date_added', 'is', null)

  if (packedError) throw packedError

  let avgLeadTimeDays: number | null = null
  const packedRows = (recentPacked ?? []).filter(r => r.date_added && r.date_packed)
  if (packedRows.length > 0) {
    const totalLeadDays = packedRows.reduce((sum, r) => {
      const added = new Date(r.date_added)
      const packed = new Date(r.date_packed)
      return sum + countWorkingDays(added, packed)
    }, 0)
    avgLeadTimeDays = Math.round((totalLeadDays / packedRows.length) * 10) / 10
  }

  const withAge = items.map(i => {
    const addedDate = new Date(i.date_added)
    return {
      id: i.id as number,
      item_number: (i as { item_number?: string | null }).item_number ?? null,
      description: (i as { description?: string | null }).description ?? null,
      amount: (i.amount as number) || 0,
      priority: Boolean(i.priority),
      date_added: i.date_added as string,
      workingDaysOld: countWorkingDays(addedDate, now),
    }
  })

  const topCritical = withAge
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1
      return b.workingDaysOld - a.workingDaysOld
    })
    .slice(0, 5)

  return {
    queueStuks,
    queueLines,
    backlogStuks,
    backlogLines,
    priorityStuks,
    oldestWorkingDays,
    avgLeadTimeDays,
    backlogPct: queueStuks > 0 ? Math.round((backlogStuks / queueStuks) * 100) : 0,
    topCritical,
  }
}
