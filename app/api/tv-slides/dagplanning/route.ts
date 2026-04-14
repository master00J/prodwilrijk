import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [statusRes, empRes, machineRes] = await Promise.all([
      supabaseAdmin
        .from('employee_daily_status')
        .select('employee_id, status, assigned_machine_id, notes')
        .eq('date', today),
      supabaseAdmin.from('employees').select('id, name'),
      supabaseAdmin.from('machines').select('id, name'),
    ])

    const statuses = statusRes.data || []
    const employees = empRes.data || []
    const machines = machineRes.data || []

    const empMap = new Map(employees.map((e: any) => [e.id, e.name]))
    const machineMap = new Map(machines.map((m: any) => [m.id, m.name]))

    const entries = statuses.map((s: any) => ({
      employeeName: empMap.get(s.employee_id) || `Medewerker ${s.employee_id}`,
      status: s.status || 'aanwezig',
      machine: s.assigned_machine_id ? machineMap.get(s.assigned_machine_id) || null : null,
      notes: s.notes || null,
    }))

    entries.sort((a: any, b: any) => {
      const statusOrder: Record<string, number> = { aanwezig: 0, thuiswerk: 1, verlof: 2, ziek: 3, afwezig: 4 }
      const sa = statusOrder[a.status] ?? 5
      const sb = statusOrder[b.status] ?? 5
      if (sa !== sb) return sa - sb
      const ma = a.machine || ''
      const mb = b.machine || ''
      if (ma && !mb) return -1
      if (!ma && mb) return 1
      if (ma !== mb) return ma.localeCompare(mb)
      return a.employeeName.localeCompare(b.employeeName)
    })

    const response = NextResponse.json({ date: today, entries })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: unknown) {
    console.error('dagplanning tv-slides:', error)
    return NextResponse.json({ error: 'Kon dagplanning niet laden' }, { status: 500 })
  }
}
