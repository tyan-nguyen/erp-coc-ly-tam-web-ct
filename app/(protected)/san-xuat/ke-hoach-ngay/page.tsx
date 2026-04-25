import { redirect } from 'next/navigation'
import { KeHoachNgayListClient } from '@/components/san-xuat/ke-hoach-ngay-list-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewProductionPlan } from '@/lib/auth/roles'
import { loadKeHoachNgayListPageData } from '@/lib/san-xuat/page-data'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ plan_id?: string; from?: string; to?: string }>

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function KeHoachNgayListPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const searchParams = await props.searchParams

  if (!canViewProductionPlan(profile.role)) {
    redirect('/dashboard')
  }

  const selectedPlanId = String(searchParams.plan_id || '').trim()
  const today = new Date()
  const defaultFrom = formatLocalDate(today)
  const to = new Date(today)
  to.setDate(to.getDate() + 7)
  const defaultTo = formatLocalDate(to)
  const fromDate = String(searchParams.from || defaultFrom)
  const toDate = String(searchParams.to || defaultTo)

  const { rows, selectedPlanDetail, scheduleSummary, draftSegments } = await loadKeHoachNgayListPageData(supabase, {
    viewerRole: profile.role,
    selectedPlanId: selectedPlanId || null,
    fromDate,
    toDate,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div>
          <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
            Sản xuất
          </div>
          <h1 className="mt-4 text-2xl font-bold">Kế hoạch sản xuất ngày</h1>
        </div>
      </section>

      <KeHoachNgayListClient
        rows={rows}
        selectedPlanId={selectedPlanId || null}
        selectedPlanDetail={selectedPlanDetail}
        scheduleSummary={scheduleSummary}
        draftSegments={draftSegments}
        viewerRole={profile.role}
      />
    </div>
  )
}
