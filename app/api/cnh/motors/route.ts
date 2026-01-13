import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cnh/motors?state=received|packaged|loaded
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const state = searchParams.get('state')

    let query = supabaseAdmin
      .from('cnh_motors')
      .select('*')
      .order('received_at', { ascending: false })

    if (state) {
      query = query.eq('state', state)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching CNH motors:', error)
      return NextResponse.json(
        { error: 'Failed to fetch motors' },
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

