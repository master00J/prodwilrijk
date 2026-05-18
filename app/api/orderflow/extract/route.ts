import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { extractOrderflowDocument } from '@/lib/orderflow/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const extractRequestSchema = z.object({
  documentId: z.string().uuid(),
})

type OrderflowDocumentRow = {
  id: string
  customer_label: string | null
  original_filename: string
  mime_type: string
  raw_text: string | null
  status: string
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsedBody = extractRequestSchema.safeParse(body)

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Ongeldige extractie-aanvraag.' }, { status: 400 })
  }

  const { documentId } = parsedBody.data

  const { data: document, error: documentError } = await supabaseAdmin
    .from('orderflow_incoming_documents')
    .select('id, customer_label, original_filename, mime_type, raw_text, status')
    .eq('id', documentId)
    .maybeSingle<OrderflowDocumentRow>()

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 })
  }

  if (!document) {
    return NextResponse.json({ error: 'Orderflow document niet gevonden.' }, { status: 404 })
  }

  try {
    const result = await extractOrderflowDocument(document)

    const { data: extraction, error: insertError } = await supabaseAdmin
      .from('orderflow_extractions')
      .insert({
        incoming_document_id: document.id,
        model: `${result.provider}:${result.model}`,
        prompt_version: result.promptVersion,
        raw_response: result.rawResponse,
        parsed_order: result.parsedOrder,
        confidence: result.confidence,
        cost_usd: result.costUsd,
        latency_ms: result.latencyMs,
      })
      .select('id, model, prompt_version, parsed_order, latency_ms, created_at')
      .single()

    if (insertError) {
      throw new Error(insertError.message)
    }

    const { error: updateError } = await supabaseAdmin
      .from('orderflow_incoming_documents')
      .update({ status: 'extracted', error: null })
      .eq('id', document.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      extraction,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extractie mislukt.'

    await supabaseAdmin
      .from('orderflow_incoming_documents')
      .update({ status: 'error', error: message })
      .eq('id', document.id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
})
