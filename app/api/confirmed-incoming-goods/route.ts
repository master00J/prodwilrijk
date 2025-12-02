import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('confirmed_incoming_goods')
      .select('*')
      .order('date_confirmed', { ascending: false })

    if (error) {
      console.error('Error fetching confirmed incoming goods:', error)
      return NextResponse.json(
        { error: 'Failed to fetch confirmed items' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

