import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // First, get active time logs
    const { data: timeLogs, error: logsError } = await supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, end_time')
      .is('end_time', null)
      .eq('type', 'items_to_pack')
      .order('start_time', { ascending: false })

    if (logsError) {
      console.error('Error fetching active time logs:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch active time logs', details: logsError.message },
        { status: 500 }
      )
    }

    if (!timeLogs || timeLogs.length === 0) {
      console.log('No active time logs found')
      return NextResponse.json([])
    }

    console.log('Active time logs found:', timeLogs.length)

    // Get unique employee IDs
    const employeeIds = [...new Set(timeLogs.map((log: any) => log.employee_id))]

    // Fetch employee names
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .in('id', employeeIds)

    if (employeesError) {
      console.error('Error fetching employees:', employeesError)
      // Continue without employee names
    }

    // Create a map of employee ID to name
    const employeeMap = new Map<number, string>()
    if (employees) {
      employees.forEach((emp: any) => {
        employeeMap.set(emp.id, emp.name)
      })
    }

    // Transform data to include employee name and calculate elapsed time
    const now = new Date()
    const transformed = timeLogs.map((log: any) => {
      const start = new Date(log.start_time)
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
      const employeeName = employeeMap.get(log.employee_id) || `Employee ${log.employee_id}`
      
      return {
        id: log.id,
        employee_id: log.employee_id,
        employee_name: employeeName,
        start_time: log.start_time,
        elapsed_seconds: elapsed,
      }
    })

    console.log('Transformed active time logs:', transformed.length, 'logs')

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

