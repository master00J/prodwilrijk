// Detecteer dringend/prio in gedropte mails en zet PILS-cases automatisch op prio.

import { supabaseAdmin } from '@/lib/supabase/server'
import type { ParsedDroppedMail } from './parse-dropped-mail'

const URGENCY_RE =
  /\b(dringend|zeer\s+dringend|urgent|urgente|asap|spoed|haast|rush|prio|prioriteit|priority|high\s+priority|met\s+prio|top\s+prio|prioritaire)\b/i

export function mailTextForUrgencyCheck(parsed: ParsedDroppedMail): string {
  const parts: string[] = [parsed.subject || '']
  if (parsed.bodyText) {
    parts.push(parsed.bodyText)
  } else if (parsed.bodyHtml) {
    parts.push(
      parsed.bodyHtml
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
    )
  }
  return parts.join('\n')
}

export function detectMailUrgency(text: string): boolean {
  return URGENCY_RE.test(text)
}

export function isUrgentMail(parsed: ParsedDroppedMail, aiSaysUrgent?: boolean): boolean {
  if (aiSaysUrgent === true) return true
  return detectMailUrgency(mailTextForUrgencyCheck(parsed))
}

/** Zet priority=true op een PILS-case als de mail dringend/prio aangeeft. */
export async function markPilsPriorityFromMail(
  caseLabel: string,
  parsed: ParsedDroppedMail,
  options?: { aiSaysUrgent?: boolean }
): Promise<boolean> {
  if (!isUrgentMail(parsed, options?.aiSaysUrgent)) return false

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('grote_inpak_cases')
    .select('case_label, priority')
    .eq('case_label', caseLabel)
    .maybeSingle()

  if (fetchError) {
    console.warn('markPilsPriorityFromMail fetch:', caseLabel, fetchError.message)
    return false
  }
  if (!existing) return false
  if (existing.priority === true) return true

  const { error: updateError } = await supabaseAdmin
    .from('grote_inpak_cases')
    .update({ priority: true })
    .eq('case_label', caseLabel)

  if (updateError) {
    console.warn('markPilsPriorityFromMail update:', caseLabel, updateError.message)
    return false
  }
  return true
}
