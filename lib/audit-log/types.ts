export type AuditLogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'CONFIRM'
  | 'APPROVE'
  | 'CANCEL'
  | 'REOPEN'
  | 'DELETE'
  | 'POST'

export type AuditLogRow = {
  logId: string
  action: string
  entityType: string
  entityId: string
  entityCode: string
  actorId: string
  actorRole: string
  actorEmail: string
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
  summaryJson: Record<string, unknown>
  note: string
  requestPath: string
  createdAt: string
}

export type AuditLogPageData = {
  schemaReady: boolean
  errorMessage: string | null
  filters: {
    fromDate: string
    toDate: string
    action: string
    entityType: string
    actor: string
    role: string
  }
  rows: AuditLogRow[]
}
