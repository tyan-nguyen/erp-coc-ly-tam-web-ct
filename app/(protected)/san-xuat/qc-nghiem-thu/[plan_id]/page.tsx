import { redirect } from 'next/navigation'
import { QcNghiemThuDetailClient } from '@/components/san-xuat/qc-nghiem-thu-detail-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessQc } from '@/lib/auth/roles'
import { loadQcNghiemThuDetailPageData } from '@/lib/san-xuat/page-data'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ from?: string }>

export default async function QcNghiemThuDetailPage(props: {
  params: Promise<{ plan_id: string }>
  searchParams: SearchParams
}) {
  const { plan_id: planId } = await props.params
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessQc(profile.role)) {
    redirect('/dashboard')
  }

  const { detail } = await loadQcNghiemThuDetailPageData(supabase, {
    planId,
    viewerRole: profile.role,
  })

  return (
    <div className="space-y-6">
      <QcNghiemThuDetailClient detail={detail} viewerRole={profile.role} fastBackToList={searchParams.from === 'list'} />
    </div>
  )
}
