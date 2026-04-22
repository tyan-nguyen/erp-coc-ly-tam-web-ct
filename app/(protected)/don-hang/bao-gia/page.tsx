import Link from 'next/link'
import { BaoGiaListClient } from '@/components/don-hang/bao-gia-list-client'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isCommercialRole } from '@/lib/auth/roles'
import { loadBaoGiaListPageData } from '@/lib/bao-gia/page-data'

export default async function BaoGiaListPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const { rows } = await loadBaoGiaListPageData(supabase)
  const commercialViewer = isCommercialRole(profile.role)

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Đơn hàng
            </div>
            <h1 className="mt-4 text-2xl font-bold">Danh sách báo giá</h1>
            <p className="app-muted mt-2 max-w-3xl text-sm">
              {commercialViewer
                ? 'Theo dõi báo giá đã gửi khách, xem preview/PDF và cập nhật kết quả kinh doanh.'
                : 'Theo dõi báo giá đã tạo, số version, lần xuất PDF và trạng thái gửi khách, chốt hoặc thất bại.'}
            </p>
          </div>
          {!commercialViewer ? (
            <Link href="/boc-tach/boc-tach-nvl" className="app-outline rounded-xl px-5 py-3 text-sm font-semibold transition">
              Về danh sách bóc tách
            </Link>
          ) : null}
        </div>
      </section>

      <BaoGiaListClient rows={rows} viewerRole={profile.role} />
    </div>
  )
}
