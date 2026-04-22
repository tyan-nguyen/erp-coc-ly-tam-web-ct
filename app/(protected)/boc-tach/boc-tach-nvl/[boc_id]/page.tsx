import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BocTachDetailClient } from '@/components/boc-tach/boc-tach-detail-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole, isCommercialRole, isQlsxRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { loadBocTachDetailPageData } from '@/lib/boc-tach/detail-page'

export default async function BocTachNvlDetailPage(props: {
  params: Promise<{ boc_id: string }>
}) {
  const { boc_id: bocId } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  if (isCommercialRole(profile.role)) {
    redirect('/don-hang/bao-gia')
  }
  const qlsxViewer = isQlsxRole(profile.role)
  const adminViewer = isAdminRole(profile.role)
  const { refs, payload, locked } = await loadBocTachDetailPageData({
    supabase,
    bocId,
    qlsxViewer,
    adminViewer,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Chi tiết
            </div>
            <h1 className="mt-4 text-2xl font-bold">Chi tiết bóc tách NVL</h1>
            <p className="app-muted mt-2 max-w-3xl text-sm">
              Bóc tách, kiểm tra định mức và lập dự toán vật tư cho từng cấu hình cọc trước khi gửi QLSX.
            </p>
          </div>
          <Link
            href="/boc-tach/boc-tach-nvl"
            className="app-outline rounded-xl px-4 py-2 text-sm font-semibold transition"
          >
            Về danh sách
          </Link>
        </div>
      </section>

      <BocTachDetailClient
        bocId={bocId}
        initialPayload={payload}
        initialLocked={locked}
        refs={refs}
        viewerRole={profile.role}
      />
    </div>
  )
}
