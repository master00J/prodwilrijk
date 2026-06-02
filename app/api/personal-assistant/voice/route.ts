import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/api/log-error'
import {
  answerPersonalAssistantQuestion,
  transcribePersonalAssistantAudio,
  type PersonalAssistantMessage,
} from '@/lib/personal-assistant/chat'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 12 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const historyRaw = formData.get('history')

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio is verplicht' }, { status: 400 })
    }
    if (audio.size <= 0) {
      return NextResponse.json({ error: 'Leeg audiobestand' }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audiobestand te groot' }, { status: 400 })
    }

    let history: PersonalAssistantMessage[] = []
    if (typeof historyRaw === 'string' && historyRaw.trim()) {
      try {
        const parsed = JSON.parse(historyRaw)
        if (Array.isArray(parsed)) {
          history = parsed
        }
      } catch {
        history = []
      }
    }

    const userId = request.headers.get('x-user-id')
    const transcript = await transcribePersonalAssistantAudio(audio)
    const messages: PersonalAssistantMessage[] = [...history, { role: 'user', content: transcript }]
    const { answer, toolsUsed } = await answerPersonalAssistantQuestion(messages, { userId })

    return NextResponse.json({
      transcript,
      answer,
      toolsUsed,
    })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/personal-assistant/voice',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    const message = error instanceof Error ? error.message : 'Spraakassistent mislukt.'
    const status =
      message.includes('verplicht') ||
      message.includes('Leeg') ||
      message.includes('te groot') ||
      message.includes('herkend')
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
