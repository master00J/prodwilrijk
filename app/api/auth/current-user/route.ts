import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query parameter
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get username from user_roles
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching username:', error)
      return NextResponse.json(
        { error: 'Failed to fetch username' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      username: data?.username || 'Unknown',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

