import { readFile } from 'fs/promises'
import path from 'path'
import {
  orderflowExtractedOrderSchema,
  type OrderflowExtractedOrder,
} from '@/lib/orderflow/schema'

export type OrderflowAiProvider = 'openai' | 'anthropic'

export type OrderflowDocumentForExtraction = {
  id: string
  customer_label: string | null
  original_filename: string
  mime_type: string
  raw_text: string | null
}

export type OrderflowExtractionResult = {
  provider: OrderflowAiProvider
  model: string
  promptVersion: string
  rawResponse: Record<string, unknown>
  parsedOrder: OrderflowExtractedOrder
  confidence: number | null
  costUsd: number | null
  latencyMs: number
}

const PROMPT_VERSION = 'v1'
const MAX_DOCUMENT_CHARS = 120_000
const OPENAI_MODEL = process.env.ORDERFLOW_OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini'
const ANTHROPIC_MODEL = process.env.ORDERFLOW_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'

const ORDERFLOW_SCHEMA_DESCRIPTION = `{
  "schema_version": "orderflow.v1",
  "header": {
    "customer_name": {"value": string|null, "source_quote": string|null, "warnings": []},
    "customer_order_number": {"value": string|null, "source_quote": string|null, "warnings": []},
    "order_date": {"value": "YYYY-MM-DD"|null, "source_quote": string|null, "warnings": []},
    "requested_delivery_date": {"value": "YYYY-MM-DD"|null, "source_quote": string|null, "warnings": []},
    "delivery_address": {"value": string|null, "source_quote": string|null, "warnings": []},
    "currency": {"value": string|null, "source_quote": string|null, "warnings": []}
  },
  "lines": [
    {
      "line_number": number,
      "sku": {"value": string|null, "source_quote": string|null, "warnings": []},
      "sku_raw": {"value": string|null, "source_quote": string|null, "warnings": []},
      "description": {"value": string|null, "source_quote": string|null, "warnings": []},
      "quantity": {"value": number|null, "source_quote": string|null, "warnings": []},
      "unit_of_measure": {"value": string|null, "source_quote": string|null, "warnings": []},
      "unit_price": {"value": number|null, "source_quote": string|null, "warnings": []},
      "requested_delivery_date": {"value": "YYYY-MM-DD"|null, "source_quote": string|null, "warnings": []},
      "raw_source_text": string|null,
      "validation_status": "unvalidated",
      "validation_notes": string|null,
      "_warnings": [{"field": string|null, "message": string, "source_quote": string|null}]
    }
  ],
  "_warnings": [{"field": string|null, "message": string, "source_quote": string|null}]
}`

function getProvider(): OrderflowAiProvider {
  const provider = process.env.ORDERFLOW_AI_PROVIDER?.toLowerCase()
  if (provider === 'anthropic') return 'anthropic'
  return 'openai'
}

async function loadPrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), 'prompts', 'orderflow', 'extract-order', `${PROMPT_VERSION}.md`),
    'utf8'
  )
}

function getDocumentText(document: OrderflowDocumentForExtraction): string {
  const rawText = document.raw_text?.trim()
  if (!rawText) {
    throw new Error(
      `Document ${document.original_filename} heeft geen raw tekst. Excel, CSV, EML, TXT en digitale PDF's met tekstlaag worden ondersteund; gescande PDF's hebben nog OCR/vision nodig.`
    )
  }
  return rawText.length > MAX_DOCUMENT_CHARS
    ? `${rawText.slice(0, MAX_DOCUMENT_CHARS)}\n\n[DOCUMENT TRUNCATED FOR FIRST EXTRACTION PASS]`
    : rawText
}

function buildUserPrompt(document: OrderflowDocumentForExtraction, basePrompt: string): string {
  return `${basePrompt}

Schema:
${ORDERFLOW_SCHEMA_DESCRIPTION}

Document metadata:
- document_id: ${document.id}
- filename: ${document.original_filename}
- mime_type: ${document.mime_type}
- customer_label: ${document.customer_label || 'unknown'}

Document text:
${getDocumentText(document)}`
}

function parseJsonObject(text: string, provider: OrderflowAiProvider): unknown {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) {
    throw new Error(`${provider} gaf geen geldig JSON-object terug.`)
  }
  return JSON.parse(jsonText)
}

function validateExtractedOrder(value: unknown): OrderflowExtractedOrder {
  const parsed = orderflowExtractedOrderSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`AI-output past niet op het orderflow schema: ${parsed.error.message}`)
  }
  return parsed.data
}

function extractOpenAiText(rawResponse: Record<string, unknown>): string {
  const choices = rawResponse.choices
  if (!Array.isArray(choices)) return ''
  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') return ''
  const message = (firstChoice as Record<string, unknown>).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as Record<string, unknown>).content
  return typeof content === 'string' ? content : ''
}

function extractAnthropicText(rawResponse: Record<string, unknown>): string {
  const content = rawResponse.content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (!block || typeof block !== 'object') return ''
      const text = (block as Record<string, unknown>).text
      return typeof text === 'string' ? text : ''
    })
    .join('\n')
}

async function callOpenAi(prompt: string): Promise<{ model: string; rawResponse: Record<string, unknown>; text: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server.')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 6000,
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${rawText.slice(0, 500)}`)
  }

  const rawResponse = JSON.parse(rawText) as Record<string, unknown>
  return {
    model: OPENAI_MODEL,
    rawResponse,
    text: extractOpenAiText(rawResponse),
  }
}

async function callAnthropic(prompt: string): Promise<{ model: string; rawResponse: Record<string, unknown>; text: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY niet geconfigureerd op de server.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${rawText.slice(0, 500)}`)
  }

  const rawResponse = JSON.parse(rawText) as Record<string, unknown>
  return {
    model: ANTHROPIC_MODEL,
    rawResponse,
    text: extractAnthropicText(rawResponse),
  }
}

export async function extractOrderflowDocument(
  document: OrderflowDocumentForExtraction
): Promise<OrderflowExtractionResult> {
  const provider = getProvider()
  const prompt = buildUserPrompt(document, await loadPrompt())
  const startedAt = Date.now()
  const response = provider === 'anthropic'
    ? await callAnthropic(prompt)
    : await callOpenAi(prompt)

  const parsedJson = parseJsonObject(response.text, provider)
  const parsedOrder = validateExtractedOrder(parsedJson)

  return {
    provider,
    model: response.model,
    promptVersion: PROMPT_VERSION,
    rawResponse: response.rawResponse,
    parsedOrder,
    confidence: null,
    costUsd: null,
    latencyMs: Date.now() - startedAt,
  }
}
