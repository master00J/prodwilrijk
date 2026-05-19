import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const TRANSCRIBE_MODEL = process.env.GROTE_INPAK_VOICE_TRANSCRIBE_MODEL || 'whisper-1'
const MAX_AUDIO_BYTES = 12 * 1024 * 1024

type CaseRow = {
  case_label: string
  comment: string | null
}

function normalizeVoiceText(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bKA\b/g, 'K')
    .replace(/\bKAA\b/g, 'K')
    .replace(/\bCEE\b/g, 'C')
    .replace(/\bSEE\b/g, 'C')
    .replace(/\bKIST\b/g, '')
    .replace(/[^A-Z0-9]/g, '')
}

function stripCaseLabelFromTranscript(transcript: string, caseLabel: string): string {
  const escapedParts = caseLabel
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (escapedParts.length === 0) return transcript.trim()

  const pattern = new RegExp(escapedParts.join('[\\s-]*'), 'i')
  return transcript.replace(pattern, '').trim()
}

function cleanupVoiceNote(transcript: string): string {
  return transcript
    .replace(/\bzet\b/gi, '')
    .replace(/\bmaak\b/gi, '')
    .replace(/\bop\b\s+\bprio\b/gi, '')
    .replace(/\bpriority\b/gi, '')
    .replace(/\bprioriteit\b/gi, '')
    .replace(/\bprio\b/gi, '')
    .replace(/\bnotitie\b/gi, '')
    .replace(/\bcommentaar\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildVoicePriorityNote(existingComment: string | null | undefined, noteText: string): string {
  const nextNote = noteText ? `Prio: ${noteText}` : 'Prio'
  const current = (existingComment || '').trim()
  if (!current) return nextNote
  if (current.toLowerCase().includes(nextNote.toLowerCase())) return current
  return `${current} | ${nextNote}`
}

function findCase(transcript: string, cases: CaseRow[]): CaseRow | null {
  const normalizedTranscript = normalizeVoiceText(transcript)
  return [...cases]
    .filter(row => row.case_label)
    .sort((a, b) => b.case_label.length - a.case_label.length)
    .find(row => normalizedTranscript.includes(normalizeVoiceText(row.case_label))) || null
}

async function transcribeAudio(file: File): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const body = new FormData()
  body.append('model', TRANSCRIBE_MODEL)
  body.append('language', 'nl')
  body.append('file', file, file.name || 'grote-inpak-voice.webm')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body,
  })

  const rawBody = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI transcriptie fout ${response.status}: ${rawBody.slice(0, 500)}`)
  }

  const parsed = JSON.parse(rawBody) as { text?: string }
  const text = String(parsed.text || '').trim()
  if (!text) {
    throw new Error('OpenAI gaf geen transcriptie terug.')
  }
  return text
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio-opname ontbreekt.' }, { status: 400 })
    }

    if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio-opname is leeg of te groot.' }, { status: 400 })
    }

    const transcript = await transcribeAudio(audio)

    const { data: cases, error: casesError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, comment')
      .not('case_label', 'is', null)

    if (casesError) {
      throw casesError
    }

    const matchedCase = findCase(transcript, (cases || []) as CaseRow[])
    if (!matchedCase) {
      return NextResponse.json(
        {
          error: `Geen caselabel herkend in transcriptie: "${transcript}"`,
          transcript,
        },
        { status: 422 }
      )
    }

    const spokenRemainder = stripCaseLabelFromTranscript(transcript, matchedCase.case_label)
    const noteText = cleanupVoiceNote(spokenRemainder)
    const comment = buildVoicePriorityNote(matchedCase.comment, noteText)

    const { data, error: updateError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .update({ priority: true, comment })
      .eq('case_label', matchedCase.case_label)
      .select('case_label, priority, comment')
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      transcript,
      case: data,
    })
  } catch (error: any) {
    logApiError(error, {
      route: '/api/grote-inpak/voice-priority',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error.message || 'Voice actie mislukt.' },
      { status: 500 }
    )
  }
}
