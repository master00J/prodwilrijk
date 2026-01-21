import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const controleId = Number(params.id)
    if (!Number.isFinite(controleId)) {
      return NextResponse.json({ error: 'Invalid controle ID' }, { status: 400 })
    }

    const body = await request.json()
    const status = body?.status?.toString()
    const validStatuses = ['in behandeling', 'goedgekeurd', 'afgekeurd']

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Ongeldige status. Toegestaan: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('product_controles')
      .update({ status })
      .eq('id', controleId)
      .select('id, status')
      .single()

    if (error || !data) {
      console.error('Error updating status:', error)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, controle_id: data.id, new_status: data.status })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
