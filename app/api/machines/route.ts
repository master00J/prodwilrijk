import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { name, description, category, active, sort_order } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('machines')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || 'machine',
      active: active ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { id, name, description, category, active, sort_order } = body

  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Naam mag niet leeg zijn' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (category !== undefined) updates.category = category
  if (active !== undefined) updates.active = active
  if (sort_order !== undefined) updates.sort_order = sort_order

  const { data, error } = await supabaseAdmin
    .from('machines')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })

  const { error } = await supabaseAdmin.from('machines').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
