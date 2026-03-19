import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim()

    if (!query) {
      return NextResponse.json([])
    }

    const { data, error } = await supabaseAdmin
      .from('artikels')
      .select('id, volledige_omschrijving, artikelnummer')
      .or(`volledige_omschrijving.ilike.%${query}%,artikelnummer.ilike.%${query}%`)
      .limit(100)

    if (error) {
      console.error('Error fetching artikels:', error)
      return NextResponse.json({ error: 'Error fetching artikels' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
