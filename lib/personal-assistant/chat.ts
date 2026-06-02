import {
  PERSONAL_ASSISTANT_TOOLS,
  runPersonalAssistantTool,
  type PersonalAssistantToolName,
} from '@/lib/personal-assistant/tools'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL =
  process.env.PERSONAL_ASSISTANT_MODEL ||
  process.env.GROTE_INPAK_ASSISTANT_MODEL ||
  process.env.OPENAI_CHAT_MODEL ||
  'gpt-4o-mini'

export type PersonalAssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Je bent de persoonlijke Prodwilrijk assistent voor Jason op mobiel.

Je helpt met actuele data uit prodwilrijk.be: Grote Inpak, Prepack, Airtec, productieorder-KPI, Atlas orderstatus en opgeslagen geheugen.

Antwoord in duidelijk Nederlands, geschikt om hardop voor te lezen via oortjes.

Belangrijke tools:
- daily_briefing: ochtendcheck alles in één
- prepack_queue_summary / prepack_stats / prepack_stage_kisten
- airtec_stats / airtec_stock_summary
- grote_inpak_summary / grote_inpak_priority_overview / grote_inpak_packed_summary / grote_inpak_kanban_summary / grote_inpak_backlog_summary / grote_inpak_stock_lookup / grote_inpak_production_orders_summary
- production_kpi_summary / active_production_summary
- kist_production_status / atlas_order_status / search_grote_inpak_cases
- assistant_remember / assistant_recall_memory voor feiten en voorkeuren

Periodes: gebruik period deze_week, vorige_week, deze_maand, vandaag. Of compare_previous_period bij stats.

Belangrijk:
- Gebruik tools voor cijfers. Verzin niets.
- Geen Markdown. Korte alinea's.
- Spreek codes teken per teken.
- assistant_remember is de enige schrijf-tool; andere tools zijn read-only.
- Houd antwoorden compact tenzij om detail gevraagd.`

const MAX_MESSAGES = 16
const MAX_MESSAGE_LENGTH = 2000
const MAX_TOOL_ROUNDS = 6

type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

type OpenAiToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

function cleanAnswer(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function validateMessages(messages: PersonalAssistantMessage[]) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages is verplicht')
  }
  if (messages.length > MAX_MESSAGES) {
    throw new Error('Te veel berichten in één aanvraag')
  }
  for (const message of messages) {
    if (
      !message ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string' ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      throw new Error('Ongeldige berichtinhoud')
    }
  }
}

async function callOpenAi(messages: OpenAiMessage[]) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      tools: PERSONAL_ASSISTANT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_completion_tokens: 900,
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI assistant fout ${response.status}: ${rawText.slice(0, 500)}`)
  }

  return JSON.parse(rawText)
}

export async function answerPersonalAssistantQuestion(
  messages: PersonalAssistantMessage[],
  options?: { userId?: string | null }
): Promise<{ answer: string; toolsUsed: string[] }> {
  validateMessages(messages)

  const openAiMessages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  ]

  const toolsUsed: string[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callOpenAi(openAiMessages)
    const choice = result.choices?.[0]?.message
    if (!choice) {
      throw new Error('De assistent gaf geen antwoord terug.')
    }

    const toolCalls = (choice.tool_calls || []) as OpenAiToolCall[]
    if (toolCalls.length === 0) {
      const answer = cleanAnswer(String(choice.content || '').trim())
      if (!answer) throw new Error('De assistent gaf geen antwoord terug.')
      return { answer, toolsUsed }
    }

    openAiMessages.push({
      role: 'assistant',
      content: choice.content ?? null,
      tool_calls: toolCalls,
    })

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name as PersonalAssistantToolName
      toolsUsed.push(toolName)

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        args = {}
      }

      let toolResult: unknown
      try {
        toolResult = await runPersonalAssistantTool(toolName, args, {
          user_id: options?.userId,
        })
      } catch (error) {
        toolResult = {
          error: error instanceof Error ? error.message : 'Tool mislukt',
        }
      }

      openAiMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      })
    }
  }

  throw new Error('Te veel tool-rondes voor één vraag.')
}

export async function transcribePersonalAssistantAudio(file: File): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const transcribeModel =
    process.env.PERSONAL_ASSISTANT_TRANSCRIBE_MODEL ||
    process.env.GROTE_INPAK_VOICE_TRANSCRIBE_MODEL ||
    'gpt-4o-transcribe'

  const body = new FormData()
  body.append('model', transcribeModel)
  body.append('language', 'nl')
  body.append(
    'prompt',
    [
      'Dit is Nederlandse spraak voor de Prodwilrijk persoonlijke assistent.',
      'Belangrijke woorden: Grote Inpak, Prepack, kisttype, caselabel, shoporder, Wilrijk, Genk, Willebroek, priority, productieorder, K352, K114.',
      'Codes worden teken per teken uitgesproken.',
    ].join(' ')
  )
  body.append('file', file, file.name || 'personal-assistant.webm')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body,
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Transcriptie mislukt ${response.status}: ${rawText.slice(0, 500)}`)
  }

  const payload = JSON.parse(rawText)
  const transcript = String(payload.text || '').trim()
  if (!transcript) {
    throw new Error('Geen spraak herkend.')
  }
  return transcript
}
