import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import { normalizeSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'

export const DELETE = withAdmin(async (request, adminUser, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Ongeldig order-ID' }, { status: 400 })
    }

    const { data: order, error: fetchError } = await supabaseAdmin
      .from('production_orders')
      .select('id, order_number, site, for_time_registration')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!order) {
      return NextResponse.json({ error: 'Productieorder niet gevonden' }, { status: 404 })
    }

    if (!order.for_time_registration) {
      return NextResponse.json(
        { error: 'Alleen orders uit de tijdregistratie-flow kunnen hier verwijderd worden.' },
        { status: 400 }
      )
    }

    const site = normalizeSite(order.site)

    const { data: activeLogs, error: activeError } = await supabaseAdmin
      .from('time_logs')
      .select('id')
      .eq('type', 'production_order')
      .eq('production_order_number', order.order_number)
      .eq('site', site)
      .is('end_time', null)
      .limit(1)

    if (activeError) throw activeError
    if (activeLogs && activeLogs.length > 0) {
      return NextResponse.json(
        { error: 'Stop eerst alle actieve tijdregistraties voor deze order.' },
        { status: 409 }
      )
    }

    const { error: logsDeleteError } = await supabaseAdmin
      .from('time_logs')
      .delete()
      .eq('type', 'production_order')
      .eq('production_order_number', order.order_number)
      .eq('site', site)

    if (logsDeleteError) throw logsDeleteError

    const { error: deleteError } = await supabaseAdmin
      .from('production_orders')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'production_order_deleted',
      resource_type: 'production_orders',
      resource_id: String(id),
      details: { order_number: order.order_number, site },
    })

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
    })
  } catch (error: unknown) {
    console.error('Error deleting production order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verwijderen mislukt' },
      { status: 500 }
    )
  }
})
