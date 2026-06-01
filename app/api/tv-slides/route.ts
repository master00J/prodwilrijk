import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tv_slides')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { type, title, content, sort_order, active } = body

    if (!type || !['werkorders', 'tekst', 'afbeelding', 'productieorders', 'inpakstatistiek', 'dagplanning', 'countdown', 'weer', 'priorities', 'transportplanning'].includes(type)) {
      return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tv_slides')
      .insert({
        type,
        title: title || null,
        content: content || {},
        sort_order: sort_order ?? 0,
        active: active ?? true,
      })
      .select()
      .single()

    if (error) throw error

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'slide_created',
      resource_type: 'tv_slides',
      resource_id: String(data.id),
      details: { type, title: title || null },
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})

export const PUT = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('tv_slides')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'slide_updated',
      resource_type: 'tv_slides',
      resource_id: String(id),
      details: { updated_fields: Object.keys(updates).filter(k => k !== 'updated_at') },
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})

export const DELETE = withAdmin(async (request: NextRequest, user) => {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('tv_slides')
      .delete()
      .eq('id', id)

    if (error) throw error

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'slide_deleted',
      resource_type: 'tv_slides',
      resource_id: String(id),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})
