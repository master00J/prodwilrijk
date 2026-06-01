import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/api/log-error'
import { createPersonalAssistantRealtimeSecret } from '@/lib/personal-assistant/realtime-session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const session = await createPersonalAssistantRealtimeSecret(request.headers.get('x-user-id'))
    return NextResponse.json(session)
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/personal-assistant/realtime-session',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Realtime sessie starten mislukt.' },
      { status: 500 }
    )
  }
}
