import { NextResponse } from 'next/server'

export async function POST() {
  // Logout is handled client-side with Supabase
  return NextResponse.json({ success: true })
}

