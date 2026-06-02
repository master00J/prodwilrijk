import { NextResponse } from 'next/server'
import { PERSONAL_ASSISTANT_REALTIME_TOOLS } from '@/lib/personal-assistant/realtime-tools'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ tools: PERSONAL_ASSISTANT_REALTIME_TOOLS })
}
