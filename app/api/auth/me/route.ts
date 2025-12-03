import { NextResponse } from 'next/server'

export async function GET() {
  // Auth check is handled client-side with Supabase
  return NextResponse.json({ user: null })
}

