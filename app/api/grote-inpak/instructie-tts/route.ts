import { NextRequest, NextResponse } from 'next/server'
import {
  getInstructieStep,
  instructieSpeechText,
  type InstructieStepId,
} from '@/lib/grote-inpak/instructie-steps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const TTS_MODEL = process.env.OPENAI_INSTRUCTIE_TTS_MODEL || 'tts-1'
const TTS_VOICE = process.env.OPENAI_INSTRUCTIE_TTS_VOICE || 'nova'

const VALID_STEP_IDS = new Set<InstructieStepId>([
  'intro',
  'packed-xml',
  'stock-upload',
  'stock-verwerken',
  'forecast-upload',
  'transport-excel',
  'forecast-dates',
  'forecast-export',
  'done',
])

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY niet geconfigureerd' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const stepId = body?.stepId as InstructieStepId | undefined
    if (!stepId || !VALID_STEP_IDS.has(stepId)) {
      return NextResponse.json({ error: 'Ongeldige stap' }, { status: 400 })
    }

    const step = getInstructieStep(stepId)
    if (!step) {
      return NextResponse.json({ error: 'Stap niet gevonden' }, { status: 404 })
    }

    const input = instructieSpeechText(step)
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('Instructie TTS error:', response.status, errText)
      return NextResponse.json({ error: 'Spraak genereren mislukt' }, { status: 502 })
    }

    const audioBuffer = await response.arrayBuffer()
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Instructie TTS route error:', error)
    return NextResponse.json({ error: 'Spraak genereren mislukt' }, { status: 500 })
  }
}
