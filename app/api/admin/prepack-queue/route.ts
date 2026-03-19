import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getWorkingDaysBetween } from '@/lib/utils/workdays'

export const dynamic = 'force-dynamic'

function countWorkingDays(from: Date, to: Date): number {
  return getWorkingDaysBetween(from, to)
}

export async function GET() {
  try {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // Threshold: items older than 3 working days are backlog
    // Calculate 3 working days ago
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

    // Fetch all unpacked items
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('items_to_pack')
      .select('id, amount, priority, date_added')
      .eq('packed', false)

    if (queueError) throw queueError

    const items = queueItems ?? []

    const queueStuks = items.reduce((sum, i) => sum + (i.amount || 0), 0)
    const queueLines = items.length

    const backlogItems = items.filter((i) => {
      const d = new Date(i.date_added)
      d.setHours(0, 0, 0, 0)
      return d < backlogThreshold
    })
    const backlogStuks = backlogItems.reduce((sum, i) => sum + (i.amount || 0), 0)
    const backlogLines = backlogItems.length

    const priorityStuks = items
      .filter((i) => i.priority)
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    // Oldest item in working days
    let oldestWorkingDays = 0
    if (items.length > 0) {
      const oldest = items.reduce((min, i) =>
        new Date(i.date_added) < new Date(min.date_added) ? i : min
      )
      oldestWorkingDays = countWorkingDays(new Date(oldest.date_added), now)
    }

    // Average lead time: packed items from last 60 days that have date_added
    const since60 = new Date(now)
    since60.setDate(since60.getDate() - 60)

    const { data: recentPacked, error: packedError } = await supabaseAdmin
      .from('packed_items')
      .select('date_added, date_packed')
      .gte('date_packed', since60.toISOString())
      .not('date_added', 'is', null)

    if (packedError) throw packedError

    let avgLeadTimeDays: number | null = null
    const packedRows = (recentPacked ?? []).filter(
      (r) => r.date_added && r.date_packed
    )
    if (packedRows.length > 0) {
      const totalLeadDays = packedRows.reduce((sum, r) => {
        const added = new Date(r.date_added)
        const packed = new Date(r.date_packed)
        const days = countWorkingDays(added, packed)
        return sum + days
      }, 0)
      avgLeadTimeDays = Math.round((totalLeadDays / packedRows.length) * 10) / 10
    }

    return NextResponse.json({
      queueStuks,
      queueLines,
      backlogStuks,
      backlogLines,
      priorityStuks,
      oldestWorkingDays,
      avgLeadTimeDays,
      backlogPct: queueStuks > 0 ? Math.round((backlogStuks / queueStuks) * 100) : 0,
    })
  } catch (error) {
    console.error('prepack-queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
