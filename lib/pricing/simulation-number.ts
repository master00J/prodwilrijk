import { supabaseAdmin } from '@/lib/supabase/server'

/** Genereert uniek simulatienummer SIM-YYYYMMDD-0001 */
export async function generateSimulationNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `SIM-${today}-`

  const { count, error } = await supabaseAdmin
    .from('pricing_simulations')
    .select('id', { count: 'exact', head: true })
    .like('simulation_number', `${prefix}%`)

  if (error) throw new Error(error.message)

  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefix}${seq}`
}
