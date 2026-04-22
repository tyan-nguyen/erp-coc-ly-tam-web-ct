import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DonHangDetailClient } from '@/components/don-hang/don-hang-detail-client'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isQlsxRole } from '@/lib/auth/roles'
import { loadDonHangDetailPageData } from '@/lib/don-hang/page-data'

export default async function DonHangDetailPage(props: {
  params: Promise<{ order_id: string }>
}) {
  const { order_id: orderId } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const { detail, actorDisplayMap } = await loadDonHangDetailPageData(supabase, { orderId })
  if (isQlsxRole(profile.role) && !detail.linkedQuote.productionApproved) {
    redirect('/don-hang')
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Đơn hàng
            </div>
            <h1 className="mt-4 text-2xl font-bold">
              Đơn hàng {detail.order.ma_order || detail.order.order_id}
            </h1>
            <p className="app-muted mt-2 text-sm">
              Theo dõi thông tin đơn hàng, thông số kỹ thuật, timeline và các thao tác theo state machine.
            </p>
          </div>
          <Link
            href="/don-hang"
            className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
          >
            Về danh sách
          </Link>
        </div>
      </section>

      <DonHangDetailClient
        orderId={orderId}
        detail={detail}
        actorDisplayMap={actorDisplayMap}
      />
    </div>
  )
}
