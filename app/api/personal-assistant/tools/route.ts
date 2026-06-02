import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logApiError } from '@/lib/api/log-error'
import { logPersonalAssistantToolCall } from '@/lib/personal-assistant/audit'
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
  const userId = request.headers.get('x-user-id')
  const started = Date.now()
  let toolName = 'unknown'

  try {
    const body = await request.json().catch(() => null)
    const parsed = toolRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ongeldige tool-aanvraag.' }, { status: 400 })
    }

    toolName = parsed.data.name
    const result = await runPersonalAssistantTool(
      parsed.data.name as PersonalAssistantToolName,
      parsed.data.arguments,
      { user_id: userId }
    )

    void logPersonalAssistantToolCall({
      tool_name: toolName,
      user_id: userId,
      success: true,
      duration_ms: Date.now() - started,
    })

    return NextResponse.json({ ok: true, result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tool uitvoeren mislukt.'
    const status = message.includes('Onbekende tool') ? 400 : 500

    void logPersonalAssistantToolCall({
      tool_name: toolName,
      user_id: userId,
      success: false,
      duration_ms: Date.now() - started,
      error_message: message,
    })

    logApiError(error, {
      route: '/api/personal-assistant/tools',
      method: 'POST',
      userId,
    })
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
