import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.GROTE_INPAK_ASSISTANT_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini'
const MAX_CASES = 120
const MAX_QUESTION_LENGTH = 1000

const caseContextSchema = z.object({
  case_label: z.string().nullable().optional(),
  case_type: z.string().nullable().optional(),
  arrival_date: z.string().nullable().optional(),
  forecast_date: z.string().nullable().optional(),
  item_number: z.string().nullable().optional(),
  productielocatie: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  priority: z.boolean().nullable().optional(),
  comment: z.string().nullable().optional(),
  stock_willebroek: z.number().nullable().optional(),
  stock_genk: z.number().nullable().optional(),
  stock_wilrijk: z.number().nullable().optional(),
  in_transfer_qty: z.number().nullable().optional(),
  in_productie_qty: z.number().nullable().optional(),
  dagen_te_laat: z.number().nullable().optional(),
  status_reason: z.string().nullable().optional(),
  bc_fp_item_no: z.string().nullable().optional(),
  bc_shop_order_no: z.string().nullable().optional(),
  bc_customer_order_no: z.string().nullable().optional(),
})

const assistantRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  context: z.object({
    filters: z.record(z.string()).default({}),
    summary: z.record(z.number()).default({}),
    cases: z.array(caseContextSchema).max(300).default([]),
  }),
})

type AssistantRequest = z.infer<typeof assistantRequestSchema>

const SYSTEM_PROMPT = `Je bent de Grote Inpak assistent voor prodwilrijk.be.

Je helpt de productie/ploegleiding met cases, prioriteiten, stock, transfer, forecast en opvolging.
Antwoord in duidelijk Nederlands.

Belangrijk:
- Gebruik alleen de meegegeven context. Verzin geen cases, datums, stock of BC-nummers.
- Geef een korte conclusie en daarna concrete acties.
- Als je prioriteiten adviseert, leg kort uit waarom.
- Noem caselabels exact zoals ze in de context staan.
- Je mag redeneren in het antwoord, maar hou het praktisch: signalen, risico's, advies.
- Je voert geen database-acties uit. Formuleer acties als voorstel, bijvoorbeeld "zet K123 op priority".`

function sanitizeCase(row: z.infer<typeof caseContextSchema>) {
  return {
    case_label: row.case_label || null,
    case_type: row.case_type || null,
    arrival_date: row.arrival_date || null,
    forecast_date: row.forecast_date || null,
    productielocatie: row.productielocatie || null,
    status: row.status || null,
    priority: row.priority === true,
    comment: row.comment ? String(row.comment).slice(0, 240) : null,
    stock_willebroek: row.stock_willebroek ?? 0,
    stock_genk: row.stock_genk ?? 0,
    stock_wilrijk: row.stock_wilrijk ?? 0,
    in_transfer_qty: row.in_transfer_qty ?? 0,
    in_productie_qty: row.in_productie_qty ?? 0,
    dagen_te_laat: row.dagen_te_laat ?? 0,
    status_reason: row.status_reason ? String(row.status_reason).slice(0, 180) : null,
    bc_fp_item_no: row.bc_fp_item_no || row.item_number || null,
    bc_shop_order_no: row.bc_shop_order_no || null,
    bc_customer_order_no: row.bc_customer_order_no || null,
  }
}

function buildContextMessage(input: AssistantRequest): string {
  const cases = input.context.cases.slice(0, MAX_CASES).map(sanitizeCase)
  return JSON.stringify({
    filters: input.context.filters,
    summary: input.context.summary,
    totalCasesProvided: input.context.cases.length,
    casesShownToAssistant: cases.length,
    cases,
  })
}

async function answerGroteInpakQuestion(input: AssistantRequest): Promise<string> {
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
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'system',
          content: `Context van de huidige Grote Inpak tabel:\n${buildContextMessage(input)}`,
        },
        { role: 'user', content: input.question },
      ],
      temperature: 0.2,
      max_completion_tokens: 900,
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI assistant fout ${response.status}: ${rawText.slice(0, 500)}`)
  }

  const result = JSON.parse(rawText)
  const answer = String(result.choices?.[0]?.message?.content || '').trim()
  if (!answer) throw new Error('De assistent gaf geen antwoord terug.')
  return answer
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = assistantRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ongeldige assistent-aanvraag.' }, { status: 400 })
    }

    const answer = await answerGroteInpakQuestion(parsed.data)
    return NextResponse.json({ answer })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/assistant',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Grote Inpak assistent mislukt.' },
      { status: 500 }
    )
  }
}
