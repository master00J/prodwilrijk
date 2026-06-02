import { NextRequest, NextResponse } from 'next/server'
import { getPersonalAssistantDailyBriefing } from '@/lib/personal-assistant/briefing'

export const dynamic = 'force-dynamic'

/**
 * Cron: genereer dagelijkse briefing JSON (voor push/mail integratie later).
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const briefing = await getPersonalAssistantDailyBriefing()
    return NextResponse.json({ ok: true, briefing })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Briefing mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
