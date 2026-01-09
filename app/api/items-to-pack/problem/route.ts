import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, problem } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input. Expected array of IDs.' },
        { status: 400 }
      )
    }

    if (typeof problem !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid input. Expected boolean for problem field.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('items_to_pack')
      .update({ problem })
      .in('id', ids)

    if (error) {
      console.error('Error updating problem status:', error)
      return NextResponse.json(
        { error: 'Failed to update problem status' },
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

