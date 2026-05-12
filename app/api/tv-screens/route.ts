import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeSite } from '@/lib/sites'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: screens, error } = await supabaseAdmin
      .from('tv_screens')
      .select('*, tv_screen_slides(slide_id)')
      .order('created_at', { ascending: true })

    if (error) throw error

    const result = (screens || []).map((s: any) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      site: s.site || 'Wilrijk',
      active: s.active !== false,
      screen_group: s.screen_group || 'Algemeen',
      last_seen_at: s.last_seen_at || null,
      updated_at: s.updated_at || s.created_at,
      created_at: s.created_at,
      slideCount: (s.tv_screen_slides || []).length,
    }))

    return NextResponse.json({ data: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slug, name, site: siteInput, screen_group, active } = await request.json()
    const site = normalizeSite(siteInput)

    if (!slug || !name) {
      return NextResponse.json({ error: 'Slug en naam zijn verplicht' }, { status: 400 })
    }

    const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!cleanSlug) {
      return NextResponse.json({ error: 'Ongeldige slug' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tv_screens')
      .insert({
        slug: cleanSlug,
        name: String(name).trim(),
        site,
        screen_group: String(screen_group || 'Algemeen').trim() || 'Algemeen',
        active: active !== false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Deze slug bestaat al' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, slug, name, site, screen_group, active } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    const updates: any = {}
    if (name !== undefined) updates.name = String(name).trim()
    if (site !== undefined) updates.site = normalizeSite(site)
    if (screen_group !== undefined) updates.screen_group = String(screen_group || 'Algemeen').trim() || 'Algemeen'
    if (active !== undefined) updates.active = active !== false
    updates.updated_at = new Date().toISOString()
    if (slug !== undefined) {
      updates.slug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    }

    const { data, error } = await supabaseAdmin
      .from('tv_screens')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('tv_screens')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
