import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, title, content, sort_order, active } = body

    if (!type || !['werkorders', 'tekst', 'afbeelding'].includes(type)) {
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
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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
      .from('tv_slides')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
