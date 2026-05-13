import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

function getWeekRange(offset: number) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset + offset * 7)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(friday) }
}

export async function GET(request: NextRequest) {
  try {
    const offsetParam = request.nextUrl.searchParams.get('weekOffset')
    const offset = parseInt(offsetParam || '0', 10) || 0
    const { from, to } = getWeekRange(offset)

    const { data, error } = await supabaseAdmin
      .from('tv_transport_entries')
      .select('*')
      .gte('transport_date', from)
      .lte('transport_date', to)
      .order('transport_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: data || [], weekFrom: from, weekTo: to })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { transport_date, transport_type, destination, description, transporter_name, notes } = body

    if (!transport_date) {
      return NextResponse.json({ error: 'Datum is verplicht' }, { status: 400 })
    }
    if (!['eigen', 'extern', 'ophaling'].includes(transport_type || '')) {
      return NextResponse.json({ error: 'Ongeldig transport type' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tv_transport_entries')
      .insert({
        transport_date,
        transport_type: transport_type || 'eigen',
        destination: destination || null,
        description: description || null,
        transporter_name: transporter_name || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    if (updates.transport_type && !['eigen', 'extern', 'ophaling'].includes(updates.transport_type)) {
      return NextResponse.json({ error: 'Ongeldig transport type' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('tv_transport_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('tv_transport_entries')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})
