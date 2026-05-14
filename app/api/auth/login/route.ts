import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    const normalizedUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,64}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      )
    }

    // Do not look up the user here: existence is validated by Supabase Auth
    // during sign-in, which avoids username enumeration on this public route.
    return NextResponse.json({
      email: `${normalizedUsername}@system.local`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

