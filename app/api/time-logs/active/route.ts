import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    // First, get active time logs
    const searchParams = request.nextUrl.searchParams
    const typeFilter = searchParams.get('type') // Optional type filter
    
    let query = supabaseAdmin
      .from('time_logs')
      .select('id, employee_id, start_time, end_time, type')
      .is('end_time', null)
      .order('start_time', { ascending: false })
    
    // Filter by type if specified, otherwise get all types
    if (typeFilter) {
      query = query.eq('type', typeFilter)
    } else {
      // Default: get items_to_pack and items_to_pack_airtec
      query = query.in('type', ['items_to_pack', 'items_to_pack_airtec'])
    }

    const { data: timeLogs, error: logsError } = await query

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

    const response = NextResponse.json(transformed)
    // Don't cache active timers - they need to be real-time
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

