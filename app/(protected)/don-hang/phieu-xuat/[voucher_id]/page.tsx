import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewShipment } from '@/lib/auth/roles'
import { loadXuatHangVoucherDetailPageData } from '@/lib/xuat-hang/page-data'
import { PhieuXuatPageClient } from '@/components/xuat-hang/phieu-xuat-page-client'

type Params = Promise<{ voucher_id: string }>
type SearchParams = Promise<{ panel?: string; from?: string }>

export const dynamic = 'force-dynamic'

export default async function PhieuXuatVoucherDetailPage(props: {
  params: Params
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const { voucher_id } = await props.params
  const searchParams = await props.searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!canViewShipment(profile.role)) {
    redirect('/dashboard')
  }

  const selectedVoucherId = String(voucher_id || '').trim()
  const { pageData, selectedVoucherDetail } = await loadXuatHangVoucherDetailPageData(supabase, {
    viewerRole: profile.role,
    selectedVoucherId: selectedVoucherId || '',
  })
  const pageClientKey = [
    profile.role,
    currentMonth,
    selectedVoucherId,
    selectedVoucherDetail?.status || '',
    selectedVoucherDetail?.requestedQtyTotal || 0,
    selectedVoucherDetail?.actualQtyTotal || 0,
  ].join('|')

  return (
    <div className="space-y-6">
      <PhieuXuatPageClient
        key={pageClientKey}
        pageData={pageData}
        selectedVoucherId={selectedVoucherId || null}
        selectedVoucherDetail={selectedVoucherDetail}
        viewerRole={profile.role}
        currentMonth={currentMonth}
        detailPage
        initialReturnPanelOpen={searchParams.panel === 'return'}
        fastBackToList={searchParams.from === 'list'}
      />
    </div>
  )
}
