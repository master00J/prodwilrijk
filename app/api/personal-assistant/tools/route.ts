import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logApiError } from '@/lib/api/log-error'
import {
  runPersonalAssistantTool,
  type PersonalAssistantToolName,
} from '@/lib/personal-assistant/tools'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const toolRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  arguments: z.record(z.unknown()).default({}),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = toolRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ongeldige tool-aanvraag.' }, { status: 400 })
    }

    const result = await runPersonalAssistantTool(
      parsed.data.name as PersonalAssistantToolName,
      parsed.data.arguments
    )

    return NextResponse.json({ ok: true, result })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/personal-assistant/tools',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    const message = error instanceof Error ? error.message : 'Tool uitvoeren mislukt.'
    const status = message.includes('Onbekende tool') ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
