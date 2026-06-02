import { supabaseAdmin } from '@/lib/supabase/server'

/** True when sales_orders.unit_cost exists (migration 20260521_sales_orders_unit_cost). */
export async function salesOrdersSupportsUnitCost(): Promise<boolean> {
  const { error } = await supabaseAdmin.from('sales_orders').select('unit_cost').limit(1)
  return !error
}
