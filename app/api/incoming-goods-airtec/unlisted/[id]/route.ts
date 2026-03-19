import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('*')
      .eq('id', idNum)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...data,
      photo_urls: data.photo_urls || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/** PATCH: Update bewerkbare velden van een unlisted item. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (body.beschrijving !== undefined) {
      const val = String(body.beschrijving).trim()
      if (!val) return NextResponse.json({ error: 'Beschrijving is verplicht' }, { status: 400 })
      updates.beschrijving = val
    }
    if (body.item_number !== undefined) updates.item_number = body.item_number ? String(body.item_number).trim() : null
    if (body.lot_number !== undefined) updates.lot_number = body.lot_number ? String(body.lot_number).trim() : null
    if (body.datum_opgestuurd !== undefined) {
      updates.datum_opgestuurd = body.datum_opgestuurd ? String(body.datum_opgestuurd).trim() : null
    }
    if (body.kistnummer !== undefined) updates.kistnummer = body.kistnummer ? String(body.kistnummer).trim() : null
    if (body.divisie !== undefined) updates.divisie = body.divisie ? String(body.divisie).trim() : null
    if (body.quantity !== undefined) {
      const q = parseInt(body.quantity, 10)
      updates.quantity = Number.isFinite(q) && q >= 1 ? q : 1
    }
    if (body.opmerking !== undefined) updates.opmerking = body.opmerking ? String(body.opmerking).trim() : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .update(updates)
      .eq('id', idNum)
      .select()
      .single()

    if (error) {
      console.error('Error updating airtec unlisted item:', error)
      return NextResponse.json(
        { error: 'Failed to update item' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .delete()
      .eq('id', idNum)

    if (error) {
      console.error('Error deleting airtec unlisted item:', error)
      return NextResponse.json(
        { error: 'Failed to delete item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
