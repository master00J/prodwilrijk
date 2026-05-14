const POSTGREST_OR_GRAMMAR_CHARS = /[%*_(),."\\]/g

/**
 * Supabase .or(...) accepts a raw PostgREST filter string. Keep user search
 * terms out of that grammar so commas/operators cannot change the filter.
 */
export function sanitizePostgrestOrValue(value: string | null | undefined, maxLength = 120): string {
  return String(value || '')
    .replace(POSTGREST_OR_GRAMMAR_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
