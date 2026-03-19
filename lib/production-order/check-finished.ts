import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Check if a production order is complete (all quantities made) and set finished_at if so.
 * Call after stopping a time log.
 */
export async function checkAndMarkOrderFinished(orderNumber: string): Promise<boolean> {
  const orderNum = String(orderNumber).trim()
  if (!orderNum) return false

  const { data: order, error: orderError } = await supabaseAdmin
    .from('production_orders')
    .select('id')
    .eq('order_number', orderNum)
    .eq('for_time_registration', true)
    .is('finished_at', null)
    .maybeSingle()

  if (orderError || !order?.id) return false

  const { data: lines, error: linesError } = await supabaseAdmin
    .from('production_order_lines')
    .select('id, item_number, quantity')
    .eq('production_order_id', order.id)

  if (linesError || !lines?.length) return false

  for (const line of lines) {
    const itemNo = line.item_number?.trim()
    const requiredQty = Math.max(1, Number(line.quantity) || 1)

    const { data: logs } = await supabaseAdmin
      .from('time_logs')
      .select('production_quantity')
      .eq('type', 'production_order')
      .eq('production_order_number', orderNum)
      .eq('production_item_number', itemNo || '')
      .not('end_time', 'is', null)

    const completed = (logs || []).reduce((sum, log) => {
      const q = log.production_quantity
      const add = q == null ? 1 : Math.max(0, Number(q))
      return sum + add
    }, 0)

    if (completed < requiredQty) return false
  }

  await supabaseAdmin
    .from('production_orders')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', order.id)

  return true
}
