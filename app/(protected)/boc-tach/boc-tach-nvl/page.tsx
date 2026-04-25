import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BocTachListClient } from '@/components/boc-tach/boc-tach-list-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isCommercialRole, isQlsxRole } from '@/lib/auth/roles'
import { loadBocTachListPageData } from '@/lib/boc-tach/list-page'

export default async function BocTachNvlListPage() {
  const { profile } = await getCurrentSessionProfile()
  if (isCommercialRole(profile.role)) {
    redirect('/don-hang/bao-gia')
  }
  const qlsxViewer = isQlsxRole(profile.role)
  const { rows: listRows, error } = await loadBocTachListPageData({
    qlsxViewer,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Nghiệp vụ
            </div>
            <h1 className="mt-4 text-2xl font-bold">
              {qlsxViewer ? 'Danh sách dự toán QLSX' : 'Danh sách bóc tách'}
            </h1>
            <p className="app-muted mt-2 max-w-3xl text-sm">
              {qlsxViewer
                ? 'QLSX xem các hồ sơ đã gửi và đã duyệt để kiểm tra thông số kỹ thuật, vật tư và mở lại bóc tách khi cần.'
                : 'Theo dõi hồ sơ bóc tách, mở dự toán để kiểm tra nhanh và thao tác trước khi gửi QLSX.'}
            </p>
          </div>
          {!qlsxViewer ? (
            <Link
              href="/boc-tach/boc-tach-nvl/new"
              className="app-primary rounded-xl px-5 py-3 text-sm font-semibold transition"
            >
              Lập dự toán
            </Link>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="app-accent-soft rounded-2xl px-4 py-3 text-sm">{error.message}</section>
      ) : (
        <BocTachListClient rows={listRows} viewerRole={profile.role} />
      )}
    </div>
  )
}
