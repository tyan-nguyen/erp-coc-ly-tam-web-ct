import type { AuditLogPageData, AuditLogRow } from '@/lib/audit-log/types'

type AnySupabase = {
  from: (table: string) => {
    select: (columns?: string) => unknown
  }
}

type QueryBuilder = {
  eq?: (column: string, value: unknown) => QueryBuilder
  gte?: (column: string, value: unknown) => QueryBuilder
  lte?: (column: string, value: unknown) => QueryBuilder
  ilike?: (column: string, value: unknown) => QueryBuilder
  order?: (column: string, options?: Record<string, unknown>) => QueryBuilder
  limit?: (count: number) => QueryBuilder
  then: Promise<unknown>['then']
}

function asQuery(value: unknown) {
  return value as QueryBuilder
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

function mapRow(row: Record<string, unknown>): AuditLogRow {
  return {
    logId: normalizeText(row.log_id),
    action: normalizeText(row.action),
    entityType: normalizeText(row.entity_type),
    entityId: normalizeText(row.entity_id),
    entityCode: normalizeText(row.entity_code),
    actorId: normalizeText(row.actor_id),
    actorRole: normalizeText(row.actor_role),
    actorEmail: normalizeText(row.actor_email),
    beforeJson: (row.before_json as Record<string, unknown> | null) ?? null,
    afterJson: (row.after_json as Record<string, unknown> | null) ?? null,
    summaryJson: (row.summary_json as Record<string, unknown> | null) ?? {},
    note: normalizeText(row.note),
    requestPath: normalizeText(row.request_path),
    createdAt: normalizeText(row.created_at),
  }
}

export async function loadAuditLogPageData(
  supabase: AnySupabase,
  filters: {
    fromDate: string
    toDate: string
    action?: string
    entityType?: string
    actor?: string
    role?: string
  }
): Promise<AuditLogPageData> {
  const fromDate = normalizeText(filters.fromDate)
  const toDate = normalizeText(filters.toDate)
  const action = normalizeText(filters.action)
  const entityType = normalizeText(filters.entityType)
  const actor = normalizeText(filters.actor)
  const role = normalizeText(filters.role)

  try {
    let query = asQuery(
      supabase
        .from('system_audit_log')
        .select('log_id, action, entity_type, entity_id, entity_code, actor_id, actor_role, actor_email, before_json, after_json, summary_json, note, request_path, created_at')
    )
      .gte?.('created_at', `${fromDate}T00:00:00`)
      .lte?.('created_at', `${toDate}T23:59:59`)
      .order?.('created_at', { ascending: false })
      .limit?.(300) as QueryBuilder

    if (action) query = query.eq?.('action', action) ?? query
    if (entityType) query = query.eq?.('entity_type', entityType) ?? query
    if (actor) query = query.ilike?.('actor_email', `%${actor}%`) ?? query
    if (role) query = query.ilike?.('actor_role', `%${role}%`) ?? query

    const { data, error } = (await query) as {
      data: Array<Record<string, unknown>> | null
      error: Error | null
    }

    if (error) {
      if (isMissingAuditTableError(error)) {
        return {
          schemaReady: false,
          errorMessage: 'Chưa có bảng system_audit_log. Cần chạy sql/system_audit_log_setup.sql trong Supabase SQL editor.',
          filters: { fromDate, toDate, action, entityType, actor, role },
          rows: [],
        }
      }
      throw error
    }

    return {
      schemaReady: true,
      errorMessage: null,
      filters: { fromDate, toDate, action, entityType, actor, role },
      rows: (data ?? []).map(mapRow),
    }
  } catch (error) {
    return {
      schemaReady: false,
      errorMessage: error instanceof Error ? error.message : 'Không tải được nhật ký thao tác.',
      filters: { fromDate, toDate, action, entityType, actor, role },
      rows: [],
    }
  }
}
