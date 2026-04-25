import Link from 'next/link'
import { redirect } from 'next/navigation'
import { KeHoachNgayDetailClient } from '@/components/san-xuat/ke-hoach-ngay-detail-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewProductionPlan } from '@/lib/auth/roles'
import { loadKeHoachNgayDetailPageData } from '@/lib/san-xuat/page-data'
import { createClient } from '@/lib/supabase/server'

export default async function KeHoachNgayDetailPage(props: {
  params: Promise<{ plan_id: string }>
}) {
  const { plan_id: planId } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canViewProductionPlan(profile.role)) {
    redirect('/dashboard')
  }

  const { detail } = await loadKeHoachNgayDetailPageData(supabase, {
    planId,
    viewerRole: profile.role,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Sản xuất
            </div>
            <h1 className="mt-4 text-2xl font-bold">Chi tiết kế hoạch sản xuất</h1>
            <p className="app-muted mt-2 text-sm">
              Quản lý các dòng sản xuất trong ngày, theo từng đơn hàng và từng đoạn cụ thể.
            </p>
          </div>
          <Link
            href="/san-xuat/ke-hoach-ngay"
            className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
          >
            Về danh sách
          </Link>
        </div>
      </section>

      <KeHoachNgayDetailClient detail={detail} viewerRole={profile.role} />
    </div>
  )
}
