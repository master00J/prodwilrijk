import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const { data: screen, error: screenErr } = await supabaseAdmin
      .from('tv_screens')
      .select('id, site')
      .eq('slug', slug)
      .single()

    if (screenErr || !screen) {
      return NextResponse.json({ error: 'Scherm niet gevonden' }, { status: 404 })
    }

    const { data: links, error: linksErr } = await supabaseAdmin
      .from('tv_screen_slides')
      .select('slide_id, sort_order')
      .eq('screen_id', screen.id)
      .order('sort_order', { ascending: true })

    if (linksErr) throw linksErr

    const slideIds = (links || []).map((l: any) => l.slide_id)
    if (slideIds.length === 0) {
      return NextResponse.json({ data: [], screen: { site: screen.site || 'Wilrijk' } })
    }

    const { data: slides, error: slidesErr } = await supabaseAdmin
      .from('tv_slides')
      .select('*')
      .in('id', slideIds)

    if (slidesErr) throw slidesErr

    const sortMap = new Map((links || []).map((l: any) => [l.slide_id, l.sort_order]))
    const sorted = (slides || []).sort((a: any, b: any) => {
      return (sortMap.get(a.id) ?? 999) - (sortMap.get(b.id) ?? 999)
    })

    return NextResponse.json({ data: sorted, screen: { site: screen.site || 'Wilrijk' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { slideIds } = await request.json()

    if (!Array.isArray(slideIds)) {
      return NextResponse.json({ error: 'slideIds moet een array zijn' }, { status: 400 })
    }

    const { data: screen, error: screenErr } = await supabaseAdmin
      .from('tv_screens')
      .select('id')
      .eq('slug', slug)
      .single()

    if (screenErr || !screen) {
      return NextResponse.json({ error: 'Scherm niet gevonden' }, { status: 404 })
    }

    await supabaseAdmin
      .from('tv_screen_slides')
      .delete()
      .eq('screen_id', screen.id)

    if (slideIds.length > 0) {
      const rows = slideIds.map((sid: string, idx: number) => ({
        screen_id: screen.id,
        slide_id: sid,
        sort_order: idx,
      }))

      const { error: insertErr } = await supabaseAdmin
        .from('tv_screen_slides')
        .insert(rows)

      if (insertErr) throw insertErr
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
