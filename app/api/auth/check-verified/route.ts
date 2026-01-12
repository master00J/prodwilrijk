import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query parameter (sent from client)
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ verified: false }, { status: 400 })
    }

    // Check if user is verified
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('verified')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking verification status:', error)
      return NextResponse.json({ verified: false })
    }

    // If user doesn't have a role entry, they're not verified
    if (!data) {
      return NextResponse.json({ verified: false })
    }

    return NextResponse.json({ verified: data.verified === true })
  } catch (error) {
    console.error('Unexpected error checking verification status:', error)
    return NextResponse.json({ verified: false }, { status: 500 })
  }
}



