import type { ActiveOrderGroup, ActiveSession } from './types'

export function groupActiveByOrder(sessions: ActiveSession[]): ActiveOrderGroup[] {
  const map = new Map<string, ActiveOrderGroup>()

  sessions.forEach((session) => {
    const orderKey = `${session.site || ''}::${session.order_number || 'Onbekend'}`
    const existing = map.get(orderKey)
    if (!existing) {
      map.set(orderKey, {
        order_number: session.order_number || 'Onbekend',
        site: session.site || '',
        sessions: [session],
        workers: session.employee_name ? [session.employee_name] : [],
        items: session.item_number ? [session.item_number] : [],
        steps: session.step ? [session.step] : [],
        maxElapsed: session.elapsed_seconds || 0,
        earliestStart: session.start_time ?? null,
      })
      return
    }

    existing.sessions.push(session)
    if (session.employee_name && !existing.workers.includes(session.employee_name)) {
      existing.workers.push(session.employee_name)
    }
    if (session.item_number && !existing.items.includes(session.item_number)) {
      existing.items.push(session.item_number)
    }
    if (session.step && !existing.steps.includes(session.step)) {
      existing.steps.push(session.step)
    }
    existing.maxElapsed = Math.max(existing.maxElapsed, session.elapsed_seconds || 0)
    if (session.start_time && (!existing.earliestStart || session.start_time < existing.earliestStart)) {
      existing.earliestStart = session.start_time
    }
  })

  return Array.from(map.values()).sort(
    (a, b) => b.maxElapsed - a.maxElapsed || a.order_number.localeCompare(b.order_number)
  )
}
