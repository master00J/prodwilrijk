import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeIds, orderNumber, itemNumber, step } = body

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'Employee IDs array is required' },
        { status: 400 }
      )
    }
    if (!orderNumber || !itemNumber || !step) {
      return NextResponse.json(
        { error: 'orderNumber, itemNumber and step are required' },
        { status: 400 }
      )
    }

    const { data: existingLogs, error: checkError } = await supabaseAdmin
      .from('time_logs')
      .select('id, employee_id')
      .in('employee_id', employeeIds)
      .is('end_time', null)
      .eq('type', 'production_order')

    if (checkError) {
      console.error('Error checking existing logs:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing logs' },
        { status: 500 }
      )
    }

    if (existingLogs && existingLogs.length > 0) {
      const activeEmployeeIds = existingLogs.map((log: any) => log.employee_id)
      return NextResponse.json(
        { error: `Employees with IDs ${activeEmployeeIds.join(', ')} already have active production logs` },
        { status: 400 }
      )
    }

    const timeLogs = employeeIds.map((employeeId: number) => ({
      employee_id: employeeId,
      type: 'production_order',
      production_order_number: String(orderNumber).trim(),
      production_item_number: String(itemNumber).trim(),
      production_step: String(step).trim(),
      start_time: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('time_logs')
      .insert(timeLogs)
      .select()

    if (error) {
      console.error('Error creating time logs:', error)
      return NextResponse.json(
        { error: 'Failed to start time logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Started production time registration for ${employeeIds.length} employee(s)`,
      logs: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
