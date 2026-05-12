import { supabaseAdmin } from '@/lib/supabase/server'
import { DEFAULT_SITE, normalizeSite } from '@/lib/sites'

function dateInputInBelgium(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value

  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10)
}

function utcDayRange(dateInput: string): { from: string; to: string } {
  const from = new Date(`${dateInput}T00:00:00.000Z`)
  const to = new Date(`${dateInput}T23:59:59.999Z`)
  return { from: from.toISOString(), to: to.toISOString() }
}

export async function markPlanningInProgressForTimeLog(
  orderNumber: string,
  itemNumber: string,
  step: string,
  siteInput: string = DEFAULT_SITE
) {
  const plannedDate = dateInputInBelgium()
  const order = String(orderNumber || '').trim()
  const item = String(itemNumber || '').trim()
  const productionStep = String(step || '').trim()
  const site = normalizeSite(siteInput)
  if (!order || !item || !productionStep) return

  const { error } = await supabaseAdmin
    .from('production_planning_items')
    .update({
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('order_number', order)
    .eq('item_number', item)
    .eq('production_step', productionStep)
    .eq('site', site)
    .eq('planned_date', plannedDate)
    .in('status', ['planned', 'released'])

  if (error) {
    console.error('Planning status sync start failed:', error)
  }
}

export async function syncPlanningAfterTimeLogStop(
  orderNumber: string,
  itemNumber: string,
  step: string,
  siteInput: string = DEFAULT_SITE
) {
  const plannedDate = dateInputInBelgium()
  const order = String(orderNumber || '').trim()
  const item = String(itemNumber || '').trim()
  const productionStep = String(step || '').trim()
  const site = normalizeSite(siteInput)
  if (!order || !item || !productionStep) return

  const { data: planningItems, error: planningError } = await supabaseAdmin
    .from('production_planning_items')
    .select('id, planned_quantity')
    .eq('order_number', order)
    .eq('item_number', item)
    .eq('production_step', productionStep)
    .eq('site', site)
    .eq('planned_date', plannedDate)
    .eq('status', 'in_progress')

  if (planningError) {
    console.error('Planning status sync stop lookup failed:', planningError)
    return
  }

  if (!planningItems || planningItems.length === 0) return

  const { count: activeCount, error: activeError } = await supabaseAdmin
    .from('time_logs')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'production_order')
    .eq('production_order_number', order)
    .eq('production_item_number', item)
    .eq('production_step', productionStep)
    .eq('site', site)
    .is('end_time', null)

  if (activeError) {
    console.error('Planning status sync active lookup failed:', activeError)
    return
  }

  if ((activeCount || 0) > 0) return

  const { from, to } = utcDayRange(plannedDate)
  const { data: finishedLogs, error: finishedError } = await supabaseAdmin
    .from('time_logs')
    .select('production_quantity')
    .eq('type', 'production_order')
    .eq('production_order_number', order)
    .eq('production_item_number', item)
    .eq('production_step', productionStep)
    .eq('site', site)
    .not('end_time', 'is', null)
    .gte('start_time', from)
    .lte('start_time', to)

  if (finishedError) {
    console.error('Planning status sync finished lookup failed:', finishedError)
    return
  }

  const completedQty = (finishedLogs || []).reduce((sum: number, log: any) => {
    return sum + (log.production_quantity == null ? 1 : Math.max(0, Number(log.production_quantity)))
  }, 0)

  for (const itemRow of planningItems) {
    const plannedQty = itemRow.planned_quantity == null ? null : Math.max(0, Number(itemRow.planned_quantity))
    const nextStatus = plannedQty == null || completedQty >= plannedQty ? 'done' : 'released'
    const { error } = await supabaseAdmin
      .from('production_planning_items')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemRow.id)

    if (error) {
      console.error('Planning status sync stop update failed:', error)
    }
  }
}
