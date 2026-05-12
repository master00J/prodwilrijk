import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const { data: screen, error: screenError } = await supabaseAdmin
      .from('tv_screens')
      .select('id, slug, name, site, active, screen_group, last_seen_at')
      .eq('slug', slug)
      .single()

    if (screenError || !screen) {
      return NextResponse.json({ error: 'Scherm niet gevonden' }, { status: 404 })
    }

    const site = screen.site || 'Wilrijk'
    const today = new Date().toISOString().slice(0, 10)

    const [linksRes, dagplanningRes, productionRes, prioritiesPrepackRes, prioritiesAirtecRes] = await Promise.all([
      supabaseAdmin
        .from('tv_screen_slides')
        .select('slide_id, tv_slides(id, active, type)')
        .eq('screen_id', screen.id),
      supabaseAdmin
        .from('employee_daily_status')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('site', site),
      supabaseAdmin
        .from('production_orders')
        .select('id', { count: 'exact', head: true })
        .eq('for_time_registration', true)
        .eq('site', site)
        .is('finished_at', null),
      supabaseAdmin
        .from('items_to_pack')
        .select('id', { count: 'exact', head: true })
        .eq('priority', true)
        .eq('packed', false),
      supabaseAdmin
        .from('items_to_pack_airtec')
        .select('id', { count: 'exact', head: true })
        .eq('priority', true)
        .eq('packed', false),
    ])

    const linkedSlides = linksRes.data || []
    const activeSlides = linkedSlides.filter((link: any) => {
      const slide = Array.isArray(link.tv_slides) ? link.tv_slides[0] : link.tv_slides
      return slide?.active !== false
    })

    return NextResponse.json({
      screen,
      linkedSlides: linkedSlides.length,
      activeSlides: activeSlides.length,
      dagplanningEntries: dagplanningRes.count || 0,
      openProductionOrders: productionRes.count || 0,
      priorityItems: (prioritiesPrepackRes.count || 0) + (prioritiesAirtecRes.count || 0),
      checkedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Health check mislukt' }, { status: 500 })
  }
}
