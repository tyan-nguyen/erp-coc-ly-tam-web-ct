import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlProcurement } from '@/lib/auth/roles'
import { loadReceiptDetail } from '@/lib/nvl-procurement/receipt-repository'
import { NvlReceiptDetailClient } from '@/components/nvl-procurement/receipt-detail-client'

export const dynamic = 'force-dynamic'

export default async function NvlReceiptDetailPage(props: {
  params: Promise<{ receipt_id: string }>
}) {
  const { receipt_id: receiptId } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessNvlProcurement(profile.role)) {
    redirect('/dashboard')
  }

  const detail = await loadReceiptDetail({ supabase, receiptId })
  if (!detail) {
    redirect('/ton-kho/nvl/mua-hang')
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div>
          <div className="app-muted text-xs uppercase tracking-[0.18em]">NVL / Receipt</div>
          <h1 className="mt-3 text-3xl font-semibold">Chi tiết receipt NVL</h1>
          <p className="app-muted mt-3 text-sm">
            Kho nhập số nhận thực tế theo từng đợt giao hàng. Chỉ sau khi số thực tế được lưu, thao tác `Ghi nhập kho` mới
            được phép tạo stock movement cho NVL.
          </p>
        </div>
      </section>

      <NvlReceiptDetailClient detail={detail} />
    </div>
  )
}
