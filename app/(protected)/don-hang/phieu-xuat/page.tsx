import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewShipment } from '@/lib/auth/roles'
import { loadXuatHangPhieuPageData } from '@/lib/xuat-hang/page-data'
import { PhieuXuatPageClient } from '@/components/xuat-hang/phieu-xuat-page-client'

export const dynamic = 'force-dynamic'

export default async function PhieuXuatPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!canViewShipment(profile.role)) {
    redirect('/dashboard')
  }

  const { pageData } = await loadXuatHangPhieuPageData(supabase, {
    viewerRole: profile.role,
  })
  const pageClientKey = [
    profile.role,
    currentMonth,
    pageData.vouchers.length,
    ...pageData.vouchers.slice(0, 20).map((item) => item.voucherId),
  ].join('|')

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="border-b px-6 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="inline-flex rounded-full px-3 py-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase app-primary-soft">
            Xuất hàng
          </div>
          <h1 className="mt-2 text-xl font-bold">Phiếu xuất hàng</h1>
          <div className="mt-3 flex flex-wrap gap-6 border-b text-sm" style={{ borderColor: 'var(--color-border)' }}>
            <span className="border-b-2 px-1 pb-2 font-semibold" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
              Cọc thành phẩm
            </span>
            <Link href="/don-hang/phieu-xuat/nvl" prefetch className="px-1 pb-2 font-semibold app-muted transition-colors hover:text-[var(--color-foreground)]">
              Nguyên vật liệu
            </Link>
          </div>
        </div>
      </section>

      <PhieuXuatPageClient
        key={pageClientKey}
        pageData={pageData}
        viewerRole={profile.role}
        currentMonth={currentMonth}
      />
    </div>
  )
}
