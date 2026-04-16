import { supabaseAdmin } from '@/lib/supabase/server'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'role_changed'
  | 'user_verified'
  | 'items_confirmed'
  | 'items_deleted'
  | 'data_imported'
  | 'email_sent'
  | 'scan_label'
  | 'slide_created'
  | 'slide_updated'
  | 'slide_deleted'
  | 'order_uploaded'
  | 'password_reset'

export interface AuditEntry {
  user_id?: string
  user_email?: string
  action: AuditAction
  resource_type: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
}

/**
 * Logs an action to the audit_logs table.
 * Fire-and-forget — never throws, never blocks the response.
 */
export function logAudit(entry: AuditEntry): void {
  supabaseAdmin
    .from('audit_logs')
    .insert({
      user_id: entry.user_id || null,
      user_email: entry.user_email || null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      details: entry.details || null,
      ip_address: entry.ip_address || null,
    })
    .then(({ error }) => {
      if (error) console.error('[Audit log failed]:', error.message)
    })
}

/**
 * Helper to extract user info from middleware-injected headers.
 */
export function auditUserFromHeaders(headers: Headers): Pick<AuditEntry, 'user_id' | 'user_email' | 'ip_address'> {
  return {
    user_id: headers.get('x-user-id') || undefined,
    user_email: headers.get('x-user-email') || undefined,
    ip_address: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
  }
}
