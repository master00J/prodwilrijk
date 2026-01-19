import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OrderItem = {
  description: string
  articleNumber: string
  quantity: number
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
