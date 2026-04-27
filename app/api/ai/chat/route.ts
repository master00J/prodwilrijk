import { NextRequest, NextResponse } from 'next/server'
import { answerProcessHelpQuestion, type ProcessHelpMessage } from '@/lib/ai/process-help'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'

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
