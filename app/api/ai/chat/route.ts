import { NextRequest, NextResponse } from 'next/server'
import { answerProcessHelpQuestion, type ProcessHelpMessage } from '@/lib/ai/process-help'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 12
const MAX_MESSAGE_LENGTH = 2000
const MAX_PAGE_PATH_LENGTH = 200

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const messages = body.messages as ProcessHelpMessage[] | undefined
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath : null

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages is verplicht' },
        { status: 400 }
      )
    }

    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: 'Te veel berichten in een aanvraag' },
        { status: 400 }
      )
    }

    if (
      messages.some(message =>
        !message ||
        (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' ||
        message.content.length > MAX_MESSAGE_LENGTH
      )
    ) {
      return NextResponse.json(
        { error: 'Ongeldige berichtinhoud' },
        { status: 400 }
      )
    }

    if (pagePath && pagePath.length > MAX_PAGE_PATH_LENGTH) {
      return NextResponse.json(
        { error: 'Ongeldige pagina-context' },
        { status: 400 }
      )
    }

    const answer = await answerProcessHelpQuestion(messages, pagePath)
    return NextResponse.json({ answer })
  } catch (error: any) {
    logApiError(error, {
      route: '/api/ai/chat',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
      details: { purpose: 'process-help-widget' },
    })
    return NextResponse.json(
      { error: error.message || 'Fout bij AI proceshulp' },
      { status: 500 }
    )
  }
}
