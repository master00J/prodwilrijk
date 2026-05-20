import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logApiError } from '@/lib/api/log-error'
import { supabaseAdmin } from '@/lib/supabase/server'
import { poFloorStatusLabel } from '@/lib/grote-inpak/po-floor-status'

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
- Antwoord alsof je met iemand praat in de ChatGPT app: natuurlijk, rustig en praktisch.
- Gebruik geen Markdown-opmaak: geen **vet**, geen ### titels, geen bullettekens, geen genummerde lijsten, geen tabellen.
- Schrijf in gewone zinnen en korte alinea's. Als je meerdere cases noemt, doe dat in lopende tekst met komma's.
- Geef eerst een korte conclusie en daarna concrete acties in natuurlijke taal.
- Als je prioriteiten adviseert, leg kort uit waarom.
- Noem caselabels exact zoals ze in de context staan.
- Spreek codes met letters en cijfers teken per teken uit. K352 is K 3 5 2, niet K driehonderd tweeënvijftig en zeker niet K325.
- Verwar case_label niet met case_type. KB91F kan het caselabel zijn, terwijl K352 het kisttype is.
- Als de gebruiker vraagt naar "achterstand", "lopen we achter" of "te laat", bedoelt hij normaal cases met dagen_te_laat groter dan 0.
- Als de gebruiker "uit Wilrijk", "van Wilrijk", "Genk" of "Willebroek" zegt, filter dan op productielocatie in de context.
- Als de gebruiker vraagt "hoeveel kisten", geef eerst het aantal cases dat aan de criteria voldoet en noem daarna kort de belangrijkste caselabels.
- Als de gebruiker vraagt naar productieorders, geplande klaar-datum, einddatum, zagerij, assemblage of vloerstatus, gebruik de extra context uit AI-geheugen en productieorders.
- Bij vragen zoals "welk productieorder is gelinkt aan kisttype K114" of "wanneer moest K114 klaar zijn", antwoord met prod_order_no en ending_date uit de productieordercontext.
- Je mag redeneren in het antwoord, maar hou het praktisch: signalen, risico's, advies.
- Je voert geen database-acties uit. Formuleer acties als voorstel, bijvoorbeeld "zet K123 op priority".`

function formatSpokenCode(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .join(' ')
}

function sanitizeCase(row: z.infer<typeof caseContextSchema>) {
  return {
    case_label: row.case_label || null,
    spoken_case_label: formatSpokenCode(row.case_label),
    case_type: row.case_type || null,
    spoken_case_type: formatSpokenCode(row.case_type),
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

function cleanAssistantAnswer(answer: string): string {
  return answer
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[>#_*~|]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractCodeCandidates(input: AssistantRequest): string[] {
  const values = new Set<string>()
  const add = (value: string | null | undefined) => {
    const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalized && /^[A-Z][A-Z0-9]{1,12}$/.test(normalized)) values.add(normalized)
  }

  for (const match of input.question.toUpperCase().matchAll(/\b[A-Z][A-Z0-9]{1,12}\b/g)) {
    add(match[0])
  }

  for (const row of input.context.cases.slice(0, 80)) {
    if (row.case_type && input.question.toUpperCase().includes(row.case_type.toUpperCase())) {
      add(row.case_type)
    }
    if (row.case_label && input.question.toUpperCase().includes(row.case_label.toUpperCase())) {
      add(row.case_label)
    }
  }

  return Array.from(values).slice(0, 8)
}

async function buildProductionMemoryContext(input: AssistantRequest): Promise<string> {
  const codes = extractCodeCandidates(input)
  if (codes.length === 0) {
    return JSON.stringify({ codes: [], memory: [], production_orders: [] })
  }

  const [memoryResult, ordersResult] = await Promise.all([
    supabaseAdmin
      .from('grote_inpak_ai_memory')
      .select('*')
      .eq('is_active', true)
      .in('subject_key', codes)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('grote_inpak_production_orders')
      .select('id, status, prod_order_no, item_no, description, productielocatie, kistnummer, quantity, finished_quantity, remaining_quantity, due_date, starting_date, ending_date, bc_source')
      .in('kistnummer', codes)
      .order('ending_date', { ascending: true, nullsFirst: false })
      .limit(30),
  ])

  if (memoryResult.error) {
    console.warn('AI-geheugen niet beschikbaar voor assistant context:', memoryResult.error.message)
  }
  if (ordersResult.error) throw ordersResult.error

  const orders = (ordersResult.data || []) as any[]
  const floorRowsResult = orders.length > 0
    ? await supabaseAdmin
      .from('grote_inpak_production_order_floor_status')
      .select('prod_order_no, item_no, bc_source, floor_status, note, updated_at')
      .in('prod_order_no', Array.from(new Set(orders.map((row) => row.prod_order_no))))
    : { data: [], error: null }

  if (floorRowsResult.error) throw floorRowsResult.error

  const floorMap = new Map<string, any>()
  for (const row of floorRowsResult.data || []) {
    floorMap.set(`${row.prod_order_no}\0${row.item_no}\0${row.bc_source || 'bc36'}`, row)
  }

  return JSON.stringify({
    codes,
    memory: (memoryResult.error ? [] : memoryResult.data || []).map((row: any) => ({
      subject_type: row.subject_type,
      subject_key: row.subject_key,
      memory_type: row.memory_type,
      value: row.value,
      note: row.note,
      updated_at: row.updated_at,
    })),
    production_orders: orders.map((row) => {
      const floor = floorMap.get(`${row.prod_order_no}\0${row.item_no}\0${row.bc_source || 'bc36'}`)
      return {
        kistnummer: row.kistnummer,
        prod_order_no: row.prod_order_no,
        item_no: row.item_no,
        description: row.description,
        productielocatie: row.productielocatie,
        bc_status: row.status,
        quantity: Number(row.quantity ?? 0),
        finished_quantity: Number(row.finished_quantity ?? 0),
        remaining_quantity: Number(row.remaining_quantity ?? 0),
        due_date: row.due_date,
        starting_date: row.starting_date,
        ending_date: row.ending_date,
        floor_status: floor?.floor_status ?? null,
        floor_status_label: poFloorStatusLabel(floor?.floor_status),
        floor_status_note: floor?.note ?? null,
        floor_status_updated_at: floor?.updated_at ?? null,
      }
    }),
  })
}

async function answerGroteInpakQuestion(input: AssistantRequest): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const productionMemoryContext = await buildProductionMemoryContext(input)

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
        {
          role: 'system',
          content: `Extra AI-geheugen en productieordercontext voor genoemde codes:\n${productionMemoryContext}`,
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
  const answer = cleanAssistantAnswer(String(result.choices?.[0]?.message?.content || '').trim())
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
