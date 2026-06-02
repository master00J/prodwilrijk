import { supabaseAdmin } from '@/lib/supabase/server'

const SUBJECT_TYPES = ['case_type', 'case_label', 'production_order', 'general'] as const
export type MemorySubjectType = (typeof SUBJECT_TYPES)[number]

function normalizeSubjectKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export async function rememberAssistantFact(input: {
  subject_type: MemorySubjectType
  subject_key: string
  value: string
  note?: string
  memory_type?: string
  user_id?: string
}) {
  const subject_type = SUBJECT_TYPES.includes(input.subject_type as MemorySubjectType)
    ? input.subject_type
    : 'general'
  const subject_key =
    subject_type === 'general'
      ? input.subject_key.trim() || 'global'
      : normalizeSubjectKey(input.subject_key)
  const value = input.value.trim()
  if (!value) throw new Error('Geheugenwaarde mag niet leeg zijn.')

  const memory_type = (input.memory_type || 'note').trim().slice(0, 40)

  const { data: existing } = await supabaseAdmin
    .from('grote_inpak_ai_memory')
    .select('id')
    .eq('subject_type', subject_type)
    .eq('subject_key', subject_key)
    .eq('memory_type', memory_type)
    .eq('is_active', true)
    .maybeSingle()

  const row = {
    subject_type,
    subject_key,
    memory_type,
    value,
    note: input.note?.trim() || null,
    source: input.user_id ? `personal_assistant:${input.user_id}` : 'personal_assistant',
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_ai_memory')
      .update(row)
      .eq('id', existing.id)
      .select('id, subject_type, subject_key, memory_type, value, note, updated_at')
      .single()
    if (error) throw error
    return { action: 'updated' as const, memory: data }
  }

  const { data, error } = await supabaseAdmin
    .from('grote_inpak_ai_memory')
    .insert(row)
    .select('id, subject_type, subject_key, memory_type, value, note, created_at')
    .single()
  if (error) throw error
  return { action: 'created' as const, memory: data }
}

export async function recallAssistantMemory(input: {
  subject_type?: MemorySubjectType
  subject_key?: string
  search?: string
  limit?: number
}) {
  const limit = Math.min(Math.max(input.limit ?? 15, 1), 40)
  let query = supabaseAdmin
    .from('grote_inpak_ai_memory')
    .select('subject_type, subject_key, memory_type, value, note, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (input.subject_type && SUBJECT_TYPES.includes(input.subject_type)) {
    query = query.eq('subject_type', input.subject_type)
  }
  if (input.subject_key?.trim()) {
    const key =
      input.subject_type === 'general'
        ? input.subject_key.trim()
        : normalizeSubjectKey(input.subject_key)
    query = query.eq('subject_key', key)
  }

  const { data, error } = await query
  if (error) throw error

  const search = (input.search || '').trim().toLowerCase()
  let rows = data || []
  if (search) {
    rows = rows.filter(row => {
      const hay = [row.subject_key, row.value, row.note, row.memory_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(search)
    })
  }

  return { count: rows.length, memories: rows }
}
