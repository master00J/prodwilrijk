import { supabaseAdmin } from '@/lib/supabase/server'

/** Best-effort logging van tool-aanroepen (faalt stil als tabel ontbreekt). */
export async function logPersonalAssistantToolCall(input: {
  tool_name: string
  user_id?: string | null
  success: boolean
  duration_ms?: number
  error_message?: string
}) {
  try {
    await supabaseAdmin.from('personal_assistant_tool_log').insert({
      tool_name: input.tool_name.slice(0, 80),
      user_id: input.user_id || null,
      success: input.success,
      duration_ms: input.duration_ms ?? null,
      error_message: input.error_message?.slice(0, 500) ?? null,
    })
  } catch {
    // Tabel mogelijk nog niet gemigreerd
  }
}
