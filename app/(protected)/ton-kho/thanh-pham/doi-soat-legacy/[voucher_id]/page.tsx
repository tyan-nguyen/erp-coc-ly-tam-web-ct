import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LegacyReconciliationDetailClient } from '@/components/ton-kho/legacy-reconciliation-detail-client'
import { V2PageHeader } from '@/components/ui/v2-page-header'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { loadLegacyReconciliationDetailPageData } from '@/lib/ton-kho-thanh-pham/reconciliation-page-data'

type Params = Promise<{ voucher_id: string }>

export const dynamic = 'force-dynamic'

export default async function LegacyReconciliationVoucherDetailPage(props: { params: Params }) {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const params = await props.params

  if (!canViewFinishedGoodsInventory(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadLegacyReconciliationDetailPageData(supabase, params.voucher_id)
  if (!pageData) notFound()

  return (
    <div className="space-y-6">
      <V2PageHeader
        eyebrow="Tồn kho"
        title={`Đối soát ${pageData.maPhieu}`}
        description="Trang này chỉ để kho kiểm tra một phiếu legacy còn gap theo từng mặt hàng, xem cây nào đang là ứng viên để gắn lại cho đúng. Chưa có thao tác ghi dữ liệu ở bước này."
        actions={
          <>
            <Link
              href="/ton-kho/thanh-pham/doi-soat-legacy"
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Quay lại danh sách
            </Link>
            <Link
              href={`/don-hang/phieu-xuat/${pageData.voucherId}`}
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Mở phiếu gốc
            </Link>
          </>
        }
      />

      <LegacyReconciliationDetailClient pageData={pageData} />
    </div>
  )
}
