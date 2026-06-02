import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/api/log-error'
import {
  answerPersonalAssistantQuestion,
  type PersonalAssistantMessage,
} from '@/lib/personal-assistant/chat'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const messages = body?.messages as PersonalAssistantMessage[] | undefined

    const { answer, toolsUsed } = await answerPersonalAssistantQuestion(messages || [], {
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json({ answer, toolsUsed })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/personal-assistant/chat',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    const message = error instanceof Error ? error.message : 'Persoonlijke assistent mislukt.'
    const status = message.includes('verplicht') || message.includes('Ongeldige') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
