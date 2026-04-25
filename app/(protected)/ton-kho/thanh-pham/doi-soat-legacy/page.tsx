import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { V2PageHeader } from '@/components/ui/v2-page-header'
import { LegacyReconciliationPageClient } from '@/components/ton-kho/legacy-reconciliation-page-client'
import { loadLegacyReconciliationPageData } from '@/lib/ton-kho-thanh-pham/reconciliation-page-data'

type SearchParams = Promise<{
  q?: string
  page?: string
}>

export const dynamic = 'force-dynamic'

export default async function LegacyReconciliationInventoryPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const searchParams = await props.searchParams

  if (!canViewFinishedGoodsInventory(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadLegacyReconciliationPageData(supabase, searchParams)

  return (
    <div className="space-y-6">
      <V2PageHeader
        eyebrow="Tồn kho"
        title="Đối soát serial legacy"
        description="Liệt kê các phiếu xuất cũ còn khoảng thiếu giữa số đã xuất và số serial đã gắn. Đây là bước chuẩn bị để kho đối soát dần, giúp summary tồn và serial detail hội tụ về cùng một dữ liệu thật."
      />

      <LegacyReconciliationPageClient pageData={pageData} />
    </div>
  )
}
