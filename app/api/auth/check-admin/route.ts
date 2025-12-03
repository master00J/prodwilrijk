import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query parameter (sent from client)
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ isAdmin: false }, { status: 400 })
    }

    // Check if user has admin role
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (error) {
      console.error('Error checking admin status:', error)
      return NextResponse.json({ isAdmin: false })
    }

    return NextResponse.json({ isAdmin: !!data })
  } catch (error) {
    console.error('Unexpected error checking admin status:', error)
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}

