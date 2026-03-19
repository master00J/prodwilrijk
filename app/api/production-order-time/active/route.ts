import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { calculateWorkedSeconds } from '@/lib/utils/time'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_request: NextRequest) {
  try {
    const { data: timeLogs, error: logsError } = await supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, end_time, production_order_number, production_item_number, production_step, production_quantity')
      .is('end_time', null)
      .eq('type', 'production_order')
      .order('start_time', { ascending: false })

    if (logsError) {
      console.error('Error fetching active time logs:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch active time logs' },
        { status: 500 }
      )
    }

    if (!timeLogs || timeLogs.length === 0) {
      return NextResponse.json([])
    }

    const employeeIds = [...new Set(timeLogs.map((log: any) => log.employee_id))]
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .in('id', employeeIds)

    const employeeMap = new Map<number, string>()
    if (employees) {
      employees.forEach((emp: any) => employeeMap.set(emp.id, emp.name))
    }

    const now = new Date()
    const transformed = timeLogs.map((log: any) => {
      const start = new Date(log.start_time)
      const elapsed = calculateWorkedSeconds(start, now)
      return {
        id: log.id,
        employee_id: log.employee_id,
        employee_name: employeeMap.get(log.employee_id) || `Employee ${log.employee_id}`,
        start_time: log.start_time,
        elapsed_seconds: elapsed,
        order_number: log.production_order_number || '',
        item_number: log.production_item_number || '',
        step: log.production_step || '',
        quantity: log.production_quantity ?? null,
      }
    })

    const response = NextResponse.json(transformed)
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
