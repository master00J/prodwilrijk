import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OrderItem = {
  description: string
  articleNumber: string
  quantity: number
}

type UpdateReceivedBody = {
  ids: number[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const openOnly = searchParams.get('open_only') === 'true'

    let query = supabaseAdmin
      .from('bestellingen_algemeen')
      .select('id, artikel_omschrijving, artikelnummer, aantal, ontvangen, created_at')
      .order('created_at', { ascending: false })

    if (openOnly) {
      query = query.eq('ontvangen', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching bestellingen:', error)
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderList: OrderItem[] = Array.isArray(body?.orderList) ? body.orderList : []

    if (orderList.length === 0) {
      return NextResponse.json({ error: 'Geen artikelen geselecteerd.' }, { status: 400 })
    }

    const rows = orderList.map((item) => ({
      artikel_omschrijving: String(item.description || '').trim(),
      artikelnummer: String(item.articleNumber || '').trim(),
      aantal: Number(item.quantity) || 0,
      ontvangen: false,
    }))

    const { error } = await supabaseAdmin.from('bestellingen_algemeen').insert(rows)

    if (error) {
      console.error('Error inserting bestelling:', error)
      return NextResponse.json({ error: 'Database insert error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Algemene bestelling geplaatst.' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateReceivedBody
    const ids = Array.isArray(body?.ids) ? body.ids : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen bestellingen geselecteerd.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bestellingen_algemeen')
      .update({ ontvangen: true })
      .in('id', ids)

    if (error) {
      console.error('Error updating bestellingen:', error)
      return NextResponse.json({ error: 'Database update error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
