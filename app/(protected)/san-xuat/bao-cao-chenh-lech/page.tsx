import { redirect } from 'next/navigation'
import { ProductionVarianceReportClient } from '@/components/san-xuat/production-variance-report-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewProductionVarianceReport } from '@/lib/auth/roles'
import { loadProductionVarianceReportPageData } from '@/lib/production-variance-report/page-data'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ from?: string; to?: string }>

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export const dynamic = 'force-dynamic'

export default async function ProductionVarianceReportPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!canViewProductionVarianceReport(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const today = new Date()
  const fromDate = String(searchParams.from || formatLocalDate(firstDayOfMonth(today)))
  const toDate = String(searchParams.to || formatLocalDate(today))
  const supabase = await createClient()
  const pageData = await loadProductionVarianceReportPageData(supabase, { fromDate, toDate })

  return <ProductionVarianceReportClient pageData={pageData} />
}
