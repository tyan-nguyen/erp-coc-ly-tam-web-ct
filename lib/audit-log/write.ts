import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLogAction } from '@/lib/audit-log/types'

type AnySupabase = SupabaseClient

export type WriteAuditLogInput = {
  action: AuditLogAction
  entityType: string
  entityId?: string | null
  entityCode?: string | null
  actorId?: string | null
  actorRole?: string | null
  actorEmail?: string | null
  beforeJson?: Record<string, unknown> | null
  afterJson?: Record<string, unknown> | null
  summaryJson?: Record<string, unknown> | null
  note?: string | null
  requestPath?: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function isMissingAuditTableError(error: unknown) {
  const message = String(
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? (error as { message: unknown }).message
        : ''
  ).toLowerCase()

  return (
    (message.includes('relation') && message.includes('system_audit_log')) ||
    (message.includes('schema cache') && message.includes('system_audit_log'))
  )
}

async function loadActorProfile(supabase: AnySupabase, actorId: string) {
  if (!actorId) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role, email')
    .eq('user_id', actorId)
    .maybeSingle()

  if (error) return null
  return data as { role?: string | null; email?: string | null } | null
}

export async function writeAuditLog(supabase: AnySupabase, input: WriteAuditLogInput) {
  try {
    const actorId = normalizeText(input.actorId)
    const actorProfile = actorId ? await loadActorProfile(supabase, actorId) : null
    const { error } = await supabase.from('system_audit_log').insert({
      action: input.action,
      entity_type: normalizeText(input.entityType) || 'UNKNOWN',
      entity_id: normalizeText(input.entityId) || null,
      entity_code: normalizeText(input.entityCode) || null,
      actor_id: actorId || null,
      actor_role: normalizeText(input.actorRole) || normalizeText(actorProfile?.role) || null,
      actor_email: normalizeText(input.actorEmail) || normalizeText(actorProfile?.email) || null,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      summary_json: input.summaryJson ?? {},
      note: normalizeText(input.note) || null,
      request_path: normalizeText(input.requestPath) || null,
    })

    if (error) {
      if (!isMissingAuditTableError(error)) {
        console.error('Audit log failed:', error.message)
      }
      return { ok: false, error }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('Audit log failed:', error)
    return { ok: false, error }
  }
}
