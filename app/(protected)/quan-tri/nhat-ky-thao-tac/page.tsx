import { redirect } from 'next/navigation'
import { AuditLogPageClient } from '@/components/audit-log/audit-log-page-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewAuditLog } from '@/lib/auth/roles'
import { loadAuditLogPageData } from '@/lib/audit-log/page-data'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{
  from?: string
  to?: string
  action?: string
  entity_type?: string
  actor?: string
  role?: string
}>

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const dynamic = 'force-dynamic'

export default async function AuditLogPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!canViewAuditLog(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)

  const pageData = await loadAuditLogPageData(await createClient(), {
    fromDate: String(searchParams.from || formatLocalDate(from)),
    toDate: String(searchParams.to || formatLocalDate(today)),
    action: searchParams.action,
    entityType: searchParams.entity_type,
    actor: searchParams.actor,
    role: searchParams.role,
  })

  return <AuditLogPageClient pageData={pageData} />
}
