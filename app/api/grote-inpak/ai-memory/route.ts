import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/api/log-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SUBJECT_TYPES = ['case_type', 'case_label', 'production_order', 'general'] as const
const MAX_LIMIT = 50

const memorySchema = z.object({
  subject_type: z.enum(SUBJECT_TYPES),
  subject_key: z.string().trim().min(1).max(120),
  memory_type: z.string().trim().min(1).max(80).default('note'),
  value: z.string().trim().min(1).max(1000),
  note: z.string().trim().max(1000).nullable().optional(),
  source: z.string().trim().max(80).default('ai_assistant'),
  expires_at: z.string().datetime().nullable().optional(),
})

function normalizeSubjectKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function sanitizeMemory(row: any) {
  return {
    id: row.id,
    subject_type: row.subject_type,
    subject_key: row.subject_key,
    memory_type: row.memory_type,
    value: row.value,
    note: row.note ?? null,
    source: row.source,
    is_active: row.is_active === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const subjectType = searchParams.get('subject_type')
    const subjectKey = searchParams.get('subject_key')
    const memoryType = searchParams.get('memory_type')
    const includeInactive = searchParams.get('include_inactive') === '1'
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), MAX_LIMIT)

    let query = supabaseAdmin
      .from('grote_inpak_ai_memory')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (!includeInactive) query = query.eq('is_active', true)
    if (subjectType && SUBJECT_TYPES.includes(subjectType as any)) query = query.eq('subject_type', subjectType)
    if (subjectKey) query = query.eq('subject_key', normalizeSubjectKey(subjectKey))
    if (memoryType) query = query.eq('memory_type', memoryType.trim())

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: (data || []).map(sanitizeMemory) })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/ai-memory',
      method: 'GET',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI-geheugen ophalen mislukt.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = memorySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ongeldige AI-geheugen aanvraag.' }, { status: 400 })
    }

    const input = parsed.data
    const row = {
      subject_type: input.subject_type,
      subject_key: normalizeSubjectKey(input.subject_key),
      memory_type: input.memory_type,
      value: input.value,
      note: input.note ?? null,
      source: input.source,
      is_active: true,
      expires_at: input.expires_at ?? null,
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('grote_inpak_ai_memory')
      .select('id')
      .eq('subject_type', row.subject_type)
      .eq('subject_key', row.subject_key)
      .eq('memory_type', row.memory_type)
      .eq('is_active', true)
      .maybeSingle()

    if (existingError) throw existingError

    const { data, error } = existing?.id
      ? await supabaseAdmin
        .from('grote_inpak_ai_memory')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single()
      : await supabaseAdmin
        .from('grote_inpak_ai_memory')
        .insert(row)
        .select('*')
        .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: sanitizeMemory(data) })
  } catch (error: unknown) {
    logApiError(error, {
      route: '/api/grote-inpak/ai-memory',
      method: 'POST',
      userId: request.headers.get('x-user-id'),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI-geheugen opslaan mislukt.' },
      { status: 500 }
    )
  }
}
