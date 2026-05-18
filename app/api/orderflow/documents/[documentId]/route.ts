import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OrderflowDocumentDetail = {
  id: string
  source: string
  customer_label: string | null
  file_path: string
  mime_type: string
  original_filename: string
  file_size_bytes: number | null
  raw_text: string | null
  status: string
  error: string | null
  received_at: string
  created_at: string
}

type OrderflowExtractionDetail = {
  id: string
  model: string
  prompt_version: string
  parsed_order: unknown
  confidence: number | null
  cost_usd: number | null
  latency_ms: number | null
  created_at: string
}

export const GET = withAuth(async (
  _request: NextRequest,
  _user,
  { params }: { params: Promise<{ documentId: string }> }
) => {
  const { documentId } = await params

  const { data: document, error: documentError } = await supabaseAdmin
    .from('orderflow_incoming_documents')
    .select('id, source, customer_label, file_path, mime_type, original_filename, file_size_bytes, raw_text, status, error, received_at, created_at')
    .eq('id', documentId)
    .maybeSingle<OrderflowDocumentDetail>()

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 })
  }

  if (!document) {
    return NextResponse.json({ error: 'Orderflow document niet gevonden.' }, { status: 404 })
  }

  const { data: extraction, error: extractionError } = await supabaseAdmin
    .from('orderflow_extractions')
    .select('id, model, prompt_version, parsed_order, confidence, cost_usd, latency_ms, created_at')
    .eq('incoming_document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<OrderflowExtractionDetail>()

  if (extractionError) {
    return NextResponse.json({ error: extractionError.message }, { status: 500 })
  }

  return NextResponse.json({
    document,
    extraction: extraction || null,
  })
})
