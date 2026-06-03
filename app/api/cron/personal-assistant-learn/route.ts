import { NextRequest, NextResponse } from 'next/server'
import { refreshPersonalAssistantLearnedBaselines } from '@/lib/personal-assistant/learned-baselines'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Cron: herbereken en bewaar Prepack/Airtec benchmarks in AI-geheugen.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshPersonalAssistantLearnedBaselines()
    return NextResponse.json({ ok: true, ...result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Learn refresh mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
