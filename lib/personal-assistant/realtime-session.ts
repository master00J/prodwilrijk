import {
  PERSONAL_ASSISTANT_REALTIME_INSTRUCTIONS,
  PERSONAL_ASSISTANT_REALTIME_TOOLS,
  PERSONAL_ASSISTANT_REALTIME_TRANSCRIBE_PROMPT,
} from '@/lib/personal-assistant/realtime-tools'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const REALTIME_MODEL =
  process.env.PERSONAL_ASSISTANT_REALTIME_MODEL ||
  process.env.GROTE_INPAK_REALTIME_MODEL ||
  'gpt-realtime'
const REALTIME_VOICE =
  process.env.PERSONAL_ASSISTANT_REALTIME_VOICE ||
  process.env.GROTE_INPAK_REALTIME_VOICE ||
  'marin'
const TRANSCRIBE_MODEL =
  process.env.PERSONAL_ASSISTANT_REALTIME_TRANSCRIBE_MODEL ||
  process.env.GROTE_INPAK_REALTIME_TRANSCRIBE_MODEL ||
  'gpt-4o-transcribe'

export function getPersonalAssistantRealtimeConfig() {
  return {
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
    transcribeModel: TRANSCRIBE_MODEL,
    instructions: PERSONAL_ASSISTANT_REALTIME_INSTRUCTIONS,
    transcribePrompt: PERSONAL_ASSISTANT_REALTIME_TRANSCRIBE_PROMPT,
  }
}

export function getClientSecret(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    value?: unknown
    client_secret?: { value?: unknown }
    session?: { client_secret?: { value?: unknown } }
  }

  if (typeof data.value === 'string') return data.value
  if (typeof data.client_secret?.value === 'string') return data.client_secret.value
  if (typeof data.session?.client_secret?.value === 'string') return data.session.client_secret.value
  return null
}

export function getExpiresAt(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    expires_at?: unknown
    client_secret?: { expires_at?: unknown }
    session?: { client_secret?: { expires_at?: unknown } }
  }

  if (typeof data.expires_at === 'number') return data.expires_at
  if (typeof data.client_secret?.expires_at === 'number') return data.client_secret.expires_at
  if (typeof data.session?.client_secret?.expires_at === 'number') return data.session.client_secret.expires_at
  return null
}

export async function createPersonalAssistantRealtimeSecret(userId: string | null) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const config = getPersonalAssistantRealtimeConfig()

  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': userId || 'personal-assistant-voice',
    },
    body: JSON.stringify({
      expires_after: {
        anchor: 'created_at',
        seconds: 600,
      },
      session: {
        type: 'realtime',
        model: config.model,
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: {
              model: config.transcribeModel,
              language: 'nl',
              prompt: config.transcribePrompt,
            },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'auto',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: config.voice,
          },
        },
        instructions: config.instructions,
        tools: PERSONAL_ASSISTANT_REALTIME_TOOLS,
        tool_choice: 'auto',
        max_output_tokens: 900,
      },
    }),
  })

  const rawBody = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI Realtime sessie fout ${response.status}: ${rawBody.slice(0, 500)}`)
  }

  const payload = JSON.parse(rawBody)
  const clientSecret = getClientSecret(payload)
  if (!clientSecret) {
    throw new Error('OpenAI Realtime gaf geen bruikbare client secret terug.')
  }

  return {
    clientSecret,
    expiresAt: getExpiresAt(payload),
    model: config.model,
    voice: config.voice,
  }
}
