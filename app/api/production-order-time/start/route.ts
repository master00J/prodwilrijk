import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { markPlanningInProgressForTimeLog } from '@/lib/production-planning/status-sync'
import { employeeHasSite, normalizeSite } from '@/lib/sites'
import { requireSiteAccess } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeIds, orderNumber, itemNumber, step } = body
    const itemNumbers = Array.isArray(body.itemNumbers)
      ? body.itemNumbers.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [String(itemNumber || '').trim()].filter(Boolean)
    const site = normalizeSite(body.site)
    const siteAccessError = requireSiteAccess(request, site)
    if (siteAccessError) return siteAccessError

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'Employee IDs array is required' },
        { status: 400 }
      )
    }
    if (!orderNumber || itemNumbers.length === 0 || !step) {
      return NextResponse.json(
        { error: 'orderNumber, itemNumbers and step are required' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id, site')
      .eq('order_number', String(orderNumber).trim())
      .eq('for_time_registration', true)
      .eq('site', site)
      .maybeSingle()

    if (orderError) {
      console.error('Error checking production order site:', orderError)
      return NextResponse.json(
        { error: 'Failed to validate production order' },
        { status: 500 }
      )
    }

    if (!order?.id) {
      return NextResponse.json(
        { error: `Order niet gevonden voor vestiging ${site}` },
        { status: 404 }
      )
    }

    const { data: employees, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, name, sites')
      .in('id', employeeIds)

    if (employeeError) {
      console.error('Error checking employee sites:', employeeError)
      return NextResponse.json(
        { error: 'Failed to validate employees' },
        { status: 500 }
      )
    }

    const employeesById = new Map((employees || []).map((employee: any) => [Number(employee.id), employee]))
    const invalidEmployeeIds = employeeIds.filter((id: number) => {
      const employee = employeesById.get(Number(id))
      return !employee || !employeeHasSite(employee, site)
    })

    if (invalidEmployeeIds.length > 0) {
      return NextResponse.json(
        { error: `Medewerker(s) niet inzetbaar op ${site}: ${invalidEmployeeIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Een medewerker mag aan meerdere orders/lijnen tegelijk werken.
    // Blokkeer alleen exact dezelfde actieve registratie zodat dubbelklikken
    // of per ongeluk twee keer starten geen dubbele log maakt.
    const { data: duplicateLogs, error: checkError } = await supabaseAdmin
      .from('time_logs')
      .select('id, employee_id')
      .in('employee_id', employeeIds)
      .is('end_time', null)
      .eq('type', 'production_order')
      .eq('site', site)
      .eq('production_order_number', String(orderNumber).trim())
      .in('production_item_number', itemNumbers)
      .eq('production_step', String(step).trim())

    if (checkError) {
      console.error('Error checking existing logs:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing logs' },
        { status: 500 }
      )
    }

    if (duplicateLogs && duplicateLogs.length > 0) {
      const activeEmployeeIds = duplicateLogs.map((log: any) => log.employee_id)
      return NextResponse.json(
        {
          error:
            `Medewerker(s) ${activeEmployeeIds.join(', ')} werken al actief aan deze order/lijn/stap. ` +
            'Kies een andere lijn/stap of stop eerst de bestaande registratie.',
        },
        { status: 400 }
      )
    }

    const startedAt = new Date().toISOString()
    const timeLogs = employeeIds.flatMap((employeeId: number) =>
      itemNumbers.map((selectedItemNumber: string) => ({
        employee_id: employeeId,
        type: 'production_order',
        production_order_number: String(orderNumber).trim(),
        production_item_number: selectedItemNumber,
        production_step: String(step).trim(),
        site,
        start_time: startedAt,
      }))
    )

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

    itemNumbers.forEach((selectedItemNumber: string) => {
      void markPlanningInProgressForTimeLog(orderNumber, selectedItemNumber, step, site)
    })

    return NextResponse.json({
      success: true,
      message: `Started production time registration for ${employeeIds.length} employee(s) on ${itemNumbers.length} line(s)`,
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
